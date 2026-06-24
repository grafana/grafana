import { act, render, testWithFeatureToggles, userEvent, waitFor } from 'test/test-utils';

import { type AdHocVariableFilter, type DataFrame, type DataQueryRequest, type ScopedVars } from '@grafana/data';
import { SQLEditor } from '@grafana/plugin-ui';
import { reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { dataSource } from '../../ExpressionDatasource';
import { type ExpressionQuery, ExpressionQueryType } from '../../types';
import { ALLOWED_FUNCTIONS, fetchSQLFields } from '../../utils/metaSqlExpr';

import { SqlEditor } from './SqlEditor/SqlEditor';
import { SqlExpr, type SqlExprProps } from './SqlExpr';
import { SqlQueryActions } from './SqlQueryActions';

function mockMetadata(request: Partial<DataQueryRequest<ExpressionQuery>>): SqlExprProps['metadata'] {
  return {
    data: {
      series: [],
      request,
    },
  } as unknown as SqlExprProps['metadata'];
}

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useStyles2: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@grafana/plugin-ui', () => ({
  QueryFormat: {
    Table: 'table',
  },
  CompletionItemKind: {
    Field: 'Field',
  },
  SQLEditor: jest.fn(({ query, onChange, children }) => (
    <div>
      <div data-testid="legacy-sql-editor">{query}</div>
      <button onClick={() => onChange('')}>Clear SQL</button>
      {children?.({ formatQuery: jest.fn() })}
    </div>
  )),
}));

jest.mock('react-virtualized-auto-sizer', () => ({
  __esModule: true,
  default: ({ children }: { children: (size: { width: number; height: number }) => unknown }) =>
    children({ width: 800, height: 300 }),
}));

jest.mock('./SqlEditor/SqlEditor', () => ({
  SqlEditor: jest.fn(({ value, onChange, children }) => (
    <div>
      <div data-testid="sql-editor">{value}</div>
      <button onClick={() => onChange('')}>Clear SQL</button>
      {children?.({ formatQuery: jest.fn() })}
    </div>
  )),
}));

jest.mock('./SqlQueryActions', () => ({
  SqlQueryActions: jest.fn(() => null),
}));

const mockBackendSrv = {
  post: jest.fn().mockResolvedValue({
    kind: 'SQLSchemaResponse',
    apiVersion: 'query.grafana.app/v0alpha1',
    sqlSchemas: {},
  }),
};

const mockDataSourceSrv = {
  get: jest.fn().mockResolvedValue({
    getRef: () => ({ uid: 'mock-ds-uid', type: 'mock-ds-type' }),
  }),
  getInstanceSettings: jest.fn().mockReturnValue({ uid: 'mock-ds-uid', type: 'mock-ds-type' }),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => mockBackendSrv,
  getDataSourceSrv: () => mockDataSourceSrv,
  reportInteraction: jest.fn(),
}));

describe('SqlExpr', () => {
  const SqlEditorMock = jest.mocked(SqlEditor);
  const SQLEditorMock = jest.mocked(SQLEditor);
  const SqlQueryActionsMock = jest.mocked(SqlQueryActions);

  beforeEach(() => {
    SqlEditorMock.mockClear();
    SQLEditorMock.mockClear();
    SqlQueryActionsMock.mockClear();
    jest.mocked(reportInteraction).mockClear();
  });

  afterEach(async () => {
    // Reset flag state so the editor selection can't leak between tests. Wrap in act()
    // because setTestFlags fires OpenFeature events that re-render the still-mounted
    // component (RTL cleanup runs in a later afterEach).
    await act(async () => {
      setTestFlags({});
    });
  });

  it('initializes new expressions with default query', async () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql', expression: '' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const updatedQuery = onChange.mock.calls[0][0];
    expect(updatedQuery.expression.toUpperCase()).toContain('SELECT');
  });

  it('preserves existing expressions when mounted', async () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const existingExpression = 'SELECT 1 AS foo';
    const query = { refId: 'expr1', type: 'sql', expression: existingExpression } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    await waitFor(() => {
      expect(query.expression).toBe(existingExpression);
    });
  });

  it('uses the legacy SQL editor when sqlExpressionsCodeMirror is disabled', async () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery;

    const { findByTestId } = render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    expect(await findByTestId('legacy-sql-editor')).toHaveTextContent('SELECT * FROM A');
    expect(SQLEditorMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        language: expect.objectContaining({
          completionProvider: expect.any(Function),
        }),
      })
    );
    expect(SqlEditorMock).not.toHaveBeenCalled();
  });

  it('uses the CodeMirror SQL editor when sqlExpressionsCodeMirror is enabled', () => {
    setTestFlags({ sqlExpressionsCodeMirror: true });

    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    expect(SqlEditorMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        value: 'SELECT * FROM A',
        completionProvider: expect.any(Object),
      })
    );
    expect(SQLEditorMock).not.toHaveBeenCalled();
  });

  it('allows clearing an existing expression without restoring the default query', async () => {
    setTestFlags({ sqlExpressionsCodeMirror: true });

    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const existingExpression = 'SELECT 1 AS foo';
    const query = { refId: 'expr1', type: 'sql', expression: existingExpression } as ExpressionQuery;
    const { findByTestId, getByRole, rerender } = render(
      <SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />
    );

    expect(await findByTestId('sql-editor')).toHaveTextContent(existingExpression);

    await userEvent.click(getByRole('button', { name: 'Clear SQL' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expression: '' }));

    rerender(<SqlExpr onChange={onChange} refIds={refIds} query={{ ...query, expression: '' }} queries={[]} />);

    expect(await findByTestId('sql-editor')).toBeEmptyDOMElement();
  });

  it('adds alerting format when alerting prop is true', async () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} alerting queries={[]} />);

    await waitFor(() => {
      const updatedQuery = onChange.mock.calls[0][0];
      expect(updatedQuery.format).toBe('alerting');
    });
  });

  it('passes SQL completions to the editor', () => {
    setTestFlags({ sqlExpressionsCodeMirror: true });

    const onChange = jest.fn();
    const refIds = [{ label: 'Query A', value: 'A' }];
    const query = { refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    expect(SqlEditorMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ariaLabel: 'SQL expression editor',
        completionProvider: expect.any(Object),
      })
    );

    // Assert against the latest render: a prior test's component can emit a late re-render
    // (see the afterEach note on lingering components) that would otherwise land as calls[0].
    expect(SqlEditorMock.mock.lastCall?.[0].completionProvider?.tables?.()).toEqual([
      expect.objectContaining({ label: 'Query A', insertText: 'A' }),
    ]);
  });

  it('quotes refId names with spaces in the seeded query and table completions', async () => {
    setTestFlags({ sqlExpressionsCodeMirror: true });

    const onChange = jest.fn();
    const refIds = [{ label: 'table A', value: 'table A' }];
    const query = { refId: 'expr1', type: 'sql', expression: '' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} queries={[]} />);

    // Read the editor props synchronously, before the await below can let a late re-render
    // (see the afterEach note on lingering components) land as a newer mock call.
    expect(SqlEditorMock.mock.lastCall?.[0].completionProvider?.tables?.()).toEqual([
      expect.objectContaining({ label: 'table A', insertText: '`table A`' }),
    ]);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].expression).toContain('`table A`');
  });

  describe('autocomplete metadata', () => {
    testWithFeatureToggles({ enable: ['sqlExpressionsColumnAutoComplete'] });

    afterEach(() => {
      jest.restoreAllMocks();
      mockDataSourceSrv.get.mockResolvedValue({
        getRef: () => ({ uid: 'mock-ds-uid', type: 'mock-ds-type' }),
      });
    });

    it('uses interpolated source queries for column autocomplete', async () => {
      setTestFlags({ sqlExpressionsCodeMirror: true });

      const onChange = jest.fn();
      const sourceQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
        expr: 'up{job="$job"}',
      };
      const interpolatedQuery = {
        ...sourceQuery,
        expr: 'up{job="api"}',
      };
      const scopedVars: ScopedVars = {
        job: { text: 'api', value: 'api' },
      };
      const filters: AdHocVariableFilter[] = [{ key: 'cluster', operator: '=', value: 'prod' }];
      const interpolateVariablesInQueries = jest.fn().mockReturnValue([interpolatedQuery]);
      const runMetaSQLExprQuery = jest
        .spyOn(dataSource, 'runMetaSQLExprQuery')
        .mockResolvedValue({ fields: [], length: 0 } as DataFrame);

      mockDataSourceSrv.get.mockResolvedValueOnce({ interpolateVariablesInQueries });

      render(
        <SqlExpr
          onChange={onChange}
          refIds={[{ value: 'A' }]}
          query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
          queries={[sourceQuery]}
          metadata={mockMetadata({ scopedVars, filters })}
        />
      );

      const completionProvider = SqlEditorMock.mock.calls[0][0].completionProvider;
      if (!completionProvider?.columns) {
        throw new Error('Expected columns completion provider');
      }

      await completionProvider.columns({ table: 'A' });

      expect(interpolateVariablesInQueries).toHaveBeenCalledWith([sourceQuery], scopedVars, filters);
      expect(runMetaSQLExprQuery.mock.calls[0][2]).toEqual([interpolatedQuery]);
    });
  });

  it('returns no column completions when the column autocomplete toggle is disabled', async () => {
    // sqlExpressionsColumnAutoComplete stays disabled here, so the provider should short-circuit
    // without ever fetching fields, even though a fetch would succeed.
    setTestFlags({ sqlExpressionsCodeMirror: true });

    const runMetaSQLExprQuery = jest.spyOn(dataSource, 'runMetaSQLExprQuery').mockResolvedValue({
      fields: [{ name: 'cpu', type: 'number', config: {}, values: [] }],
      length: 1,
    } as unknown as DataFrame);

    render(
      <SqlExpr
        onChange={jest.fn()}
        refIds={[{ value: 'A' }]}
        query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
        queries={[{ refId: 'A' }]}
      />
    );

    const completionProvider = SqlEditorMock.mock.calls[0][0].completionProvider;
    if (!completionProvider?.columns) {
      throw new Error('Expected columns completion provider');
    }

    await expect(completionProvider.columns({ table: 'A' })).resolves.toEqual([]);
    expect(runMetaSQLExprQuery).not.toHaveBeenCalled();

    runMetaSQLExprQuery.mockRestore();
  });

  describe('autocomplete completions', () => {
    testWithFeatureToggles({ enable: ['sqlExpressionsColumnAutoComplete'] });

    afterEach(() => {
      jest.restoreAllMocks();
      mockDataSourceSrv.get.mockResolvedValue({
        getRef: () => ({ uid: 'mock-ds-uid', type: 'mock-ds-type' }),
      });
    });

    it('returns no column completions when the field fetch fails', async () => {
      setTestFlags({ sqlExpressionsCodeMirror: true });

      jest.spyOn(dataSource, 'runMetaSQLExprQuery').mockRejectedValue(new Error('boom'));

      render(
        <SqlExpr
          onChange={jest.fn()}
          refIds={[{ value: 'A' }]}
          query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
          queries={[{ refId: 'A' }]}
        />
      );

      const completionProvider = SqlEditorMock.mock.calls[0][0].completionProvider;
      if (!completionProvider?.columns) {
        throw new Error('Expected columns completion provider');
      }

      await expect(completionProvider.columns({ table: 'A' })).resolves.toEqual([]);
    });

    it('maps fetched fields to column completions', async () => {
      setTestFlags({ sqlExpressionsCodeMirror: true });

      jest.spyOn(dataSource, 'runMetaSQLExprQuery').mockResolvedValue({
        fields: [{ name: 'cpu', type: 'number', config: {}, values: [] }],
        length: 1,
      } as unknown as DataFrame);

      render(
        <SqlExpr
          onChange={jest.fn()}
          refIds={[{ value: 'A' }]}
          query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
          queries={[{ refId: 'A' }]}
        />
      );

      const completionProvider = SqlEditorMock.mock.calls[0][0].completionProvider;
      if (!completionProvider?.columns) {
        throw new Error('Expected columns completion provider');
      }

      await expect(completionProvider.columns({ table: 'A' })).resolves.toEqual([
        { label: 'cpu', insertText: 'cpu', kind: 'column', boost: 50 },
      ]);
    });
  });

  it('provides allowed functions for completion', () => {
    setTestFlags({ sqlExpressionsCodeMirror: true });

    render(
      <SqlExpr
        onChange={jest.fn()}
        refIds={[{ value: 'A' }]}
        query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
        queries={[]}
      />
    );

    const completionProvider = SqlEditorMock.mock.calls[0][0].completionProvider;

    expect(completionProvider?.functions?.()).toEqual(
      ALLOWED_FUNCTIONS.map((func) => ({ label: func, insertText: func, kind: 'function' }))
    );
  });

  describe('error context', () => {
    it('collects multiple error messages from metadata', () => {
      setTestFlags({ sqlExpressionsCodeMirror: true });

      render(
        <SqlExpr
          onChange={jest.fn()}
          refIds={[{ value: 'A' }]}
          query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
          queries={[]}
          metadata={
            {
              data: {
                series: [],
                errors: [{ message: 'first error' }, {}, { message: 'second error' }],
              },
            } as unknown as SqlExprProps['metadata']
          }
        />
      );

      expect(SqlQueryActionsMock.mock.calls[0][0].errorContext).toEqual(['first error', 'second error']);
    });

    it('falls back to a single legacy error message from metadata', () => {
      setTestFlags({ sqlExpressionsCodeMirror: true });

      render(
        <SqlExpr
          onChange={jest.fn()}
          refIds={[{ value: 'A' }]}
          query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
          queries={[]}
          metadata={
            {
              data: {
                series: [],
                error: { message: 'legacy error' },
              },
            } as unknown as SqlExprProps['metadata']
          }
        />
      );

      expect(SqlQueryActionsMock.mock.calls[0][0].errorContext).toEqual(['legacy error']);
    });
  });

  it('builds query context from metadata datasources and series', () => {
    setTestFlags({ sqlExpressionsCodeMirror: true });

    render(
      <SqlExpr
        onChange={jest.fn()}
        refIds={[{ value: 'A' }]}
        query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
        queries={[]}
        metadata={
          {
            queries: [{ refId: 'A', datasource: { type: 'prometheus' } }],
            data: {
              series: [{ length: 3 }, { length: 2 }],
              request: {},
            },
          } as unknown as SqlExprProps['metadata']
        }
      />
    );

    expect(SqlQueryActionsMock.mock.calls[0][0].queryContext).toEqual(
      expect.objectContaining({
        datasources: ['prometheus'],
        totalRows: 5,
      })
    );
  });

  it('runs the query on cmd/ctrl + Enter', async () => {
    setTestFlags({ sqlExpressionsCodeMirror: true });

    const onRunQuery = jest.fn();

    render(
      <SqlExpr
        onChange={jest.fn()}
        refIds={[{ value: 'A' }]}
        query={{ refId: 'expr1', type: 'sql', expression: 'SELECT * FROM A' } as ExpressionQuery}
        queries={[]}
        onRunQuery={onRunQuery}
      />
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

    await waitFor(() => {
      expect(onRunQuery).toHaveBeenCalled();
    });
    expect(reportInteraction).toHaveBeenCalledWith(
      'dashboards_expression_interaction',
      expect.objectContaining({ action: 'execute_expression', expression_type: 'sql' })
    );
  });
});

describe('Schema Inspector feature toggle', () => {
  const defaultProps: SqlExprProps = {
    onChange: jest.fn(),
    refIds: [{ value: 'A' }],
    query: { refId: 'expression_1', type: ExpressionQueryType.sql, expression: `SELECT * FROM A LIMIT 10` },
    queries: [],
  };

  describe('when feature enabled', () => {
    testWithFeatureToggles({ enable: ['queryService', 'grafanaAPIServerWithExperimentalAPIs'] });

    afterEach(() => {
      localStorage.removeItem('grafana.sql-expression.schema-inspector-open');
      jest.clearAllMocks();
      mockBackendSrv.post.mockResolvedValue({
        kind: 'SQLSchemaResponse',
        apiVersion: 'query.grafana.app/v0alpha1',
        sqlSchemas: {},
      });
      mockDataSourceSrv.get.mockResolvedValue({
        getRef: () => ({ uid: 'mock-ds-uid', type: 'mock-ds-type' }),
      });
    });

    it('renders panel open by default', async () => {
      const { findByText } = render(<SqlExpr {...defaultProps} />);

      expect(await findByText('No schema information available')).toBeInTheDocument();
    });

    it('closes panel and shows reopen button when close button clicked', async () => {
      const { queryByText, getByText, findByText } = render(<SqlExpr {...defaultProps} />);

      expect(queryByText('No schema information available')).toBeInTheDocument();

      const closeButton = getByText('Schema inspector');
      await userEvent.click(closeButton);

      expect(queryByText('No schema information available')).not.toBeInTheDocument();
      expect(await findByText('Schema inspector')).toBeInTheDocument();
    });

    it('reopens panel when Open schema inspector button clicked after closing', async () => {
      const { queryByText, getByText } = render(<SqlExpr {...defaultProps} />);

      const closeButton = getByText('Schema inspector');
      await userEvent.click(closeButton);

      expect(queryByText('No schema information available')).not.toBeInTheDocument();

      const reopenButton = getByText('Schema inspector');
      await userEvent.click(reopenButton);

      expect(queryByText('No schema information available')).toBeInTheDocument();
    });

    it('renders tabs for multiple query refIds', async () => {
      mockBackendSrv.post.mockResolvedValue({
        kind: 'SQLSchemaResponse',
        apiVersion: 'query.grafana.app/v0alpha1',
        sqlSchemas: {
          A: { columns: [], sampleRows: [] },
          B: { columns: [], sampleRows: [] },
          C: { columns: [], sampleRows: [] },
        },
      });

      const propsWithQueries = {
        ...defaultProps,
        queries: [{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }],
      };

      const { findByRole } = render(<SqlExpr {...propsWithQueries} />);

      expect(await findByRole('tab', { name: 'A' })).toBeInTheDocument();
      expect(await findByRole('tab', { name: 'B' })).toBeInTheDocument();
      expect(await findByRole('tab', { name: 'C' })).toBeInTheDocument();
    });

    it('sends interpolated source queries to sqlschemas', async () => {
      const sourceQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
        expr: 'up{job="$job"}',
      };
      const interpolatedQuery = {
        ...sourceQuery,
        expr: 'up{job="api"}',
      };
      const scopedVars: ScopedVars = {
        job: { text: 'api', value: 'api' },
      };
      const filters: AdHocVariableFilter[] = [{ key: 'cluster', operator: '=', value: 'prod' }];
      const interpolateVariablesInQueries = jest.fn().mockReturnValue([interpolatedQuery]);

      mockDataSourceSrv.get.mockResolvedValueOnce({ interpolateVariablesInQueries });

      render(<SqlExpr {...defaultProps} queries={[sourceQuery]} metadata={mockMetadata({ scopedVars, filters })} />);

      await waitFor(() => {
        expect(mockBackendSrv.post).toHaveBeenCalled();
      });

      expect(interpolateVariablesInQueries).toHaveBeenCalledWith([sourceQuery], scopedVars, filters);

      const calls = mockBackendSrv.post.mock.calls;
      expect(calls[calls.length - 1][1].queries).toEqual([interpolatedQuery]);
    });

    it('refetches sqlschemas when interpolation context arrives after mount', async () => {
      const sourceQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
        expr: 'up{job="$job"}',
      };
      const scopedVars: ScopedVars = {
        job: { text: 'api', value: 'api' },
      };
      const interpolateVariablesInQueries = jest.fn(([query], vars) => [
        {
          ...query,
          expr: vars.job ? 'up{job="api"}' : query.expr,
        },
      ]);

      mockDataSourceSrv.get.mockResolvedValue({ interpolateVariablesInQueries });

      const { rerender } = render(<SqlExpr {...defaultProps} queries={[sourceQuery]} />);

      await waitFor(() => {
        expect(mockBackendSrv.post).toHaveBeenCalledTimes(1);
      });

      rerender(<SqlExpr {...defaultProps} queries={[sourceQuery]} metadata={mockMetadata({ scopedVars })} />);

      await waitFor(() => {
        expect(mockBackendSrv.post).toHaveBeenCalledTimes(2);
      });

      expect(mockBackendSrv.post.mock.calls[0][1].queries).toEqual([sourceQuery]);
      expect(mockBackendSrv.post.mock.calls[1][1].queries).toEqual([{ ...sourceQuery, expr: 'up{job="api"}' }]);
    });
  });

  describe('when feature disabled', () => {
    testWithFeatureToggles({ enable: [] });

    it('does not render panel or button', () => {
      const { queryByText } = render(<SqlExpr {...defaultProps} />);

      expect(queryByText('Schema inspector')).not.toBeInTheDocument();
      expect(queryByText('No schema information available')).not.toBeInTheDocument();
    });
  });
});

describe('fetchSQLFields', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockDataSourceSrv.get.mockResolvedValue({
      getRef: () => ({ uid: 'mock-ds-uid', type: 'mock-ds-type' }),
    });
  });

  it('uses interpolated source queries for autocomplete metadata queries', async () => {
    const sourceQuery = {
      refId: 'A',
      datasource: { uid: 'prometheus-uid', type: 'prometheus' },
      expr: 'up{job="$job"}',
    };
    const interpolatedQuery = {
      ...sourceQuery,
      expr: 'up{job="api"}',
    };
    const scopedVars = {
      job: { text: 'api', value: 'api' },
    };
    const filters: AdHocVariableFilter[] = [{ key: 'cluster', operator: '=', value: 'prod' }];
    const interpolateVariablesInQueries = jest.fn().mockReturnValue([interpolatedQuery]);
    const runMetaSQLExprQuery = jest
      .spyOn(dataSource, 'runMetaSQLExprQuery')
      .mockResolvedValue({ fields: [], length: 0 } as DataFrame);

    mockDataSourceSrv.get.mockResolvedValueOnce({ interpolateVariablesInQueries });

    await fetchSQLFields({ table: 'A' }, [sourceQuery], { scopedVars, filters });

    expect(interpolateVariablesInQueries).toHaveBeenCalledWith([sourceQuery], scopedVars, filters);
    expect(runMetaSQLExprQuery.mock.calls[0][2]).toEqual([interpolatedQuery]);
  });
});
