import { render, testWithFeatureToggles, userEvent, waitFor } from 'test/test-utils';

import { type AdHocVariableFilter, type DataFrame, type DataQueryRequest, type ScopedVars } from '@grafana/data';

import { dataSource } from '../../ExpressionDatasource';
import { type ExpressionQuery, ExpressionQueryType } from '../../types';
import { fetchSQLFields } from '../../utils/metaSqlExpr';

import { SqlExpr, type SqlExprProps } from './SqlExpr';

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
  SQLEditor: () => <div data-testid="sql-editor">SQL Editor Mock</div>,
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
}));

describe('SqlExpr', () => {
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
