import { act, fireEvent, queryByLabelText, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { DataSourceApi } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import type { DataSourceSrv, GetDataSourceListFilters } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataSourceRef, type DataQuery } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import createMockPanelData from 'app/plugins/datasource/azuremonitor/mocks/panelData';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { QueryEditorRows, resolveRowDataSourceSettings, type Props } from './QueryEditorRows';

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});

const mockVariable = mockDataSource({
  name: '${dsVariable}',
  type: 'datasource',
});

const dsSrvMock: Pick<DataSourceSrv, 'get' | 'getList' | 'getInstanceSettings'> = {
  get: jest.fn(
    async () => ({ getDefaultQuery: undefined, type: DataSourceType.Alertmanager }) as unknown as DataSourceApi
  ),
  getList: jest.fn((filters?: GetDataSourceListFilters) => (filters?.variables ? [mockDS, mockVariable] : [mockDS])),
  getInstanceSettings: jest.fn(() => mockDS),
};

const mockReplace = jest.fn((target?: string) => target ?? '');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => dsSrvMock,
  getTemplateSrv: () => ({
    replace: (target?: string) => mockReplace(target),
    getVariables: () => [],
    containsTemplate: () => false,
    updateTimeRange: () => {},
  }),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

jest
  .mocked(getDataSourceInstance)
  .mockImplementation((...args: unknown[]) => dsSrvMock.get(...(args as Parameters<DataSourceSrv['get']>)));
jest
  .mocked(getDataSourceInstanceSettings)
  .mockImplementation(async (...args: unknown[]) =>
    dsSrvMock.getInstanceSettings(...(args as Parameters<DataSourceSrv['getInstanceSettings']>))
  );

const props: Props = {
  queries: [
    {
      datasource: mockDS,
      refId: 'A',
    },
    {
      datasource: mockDS,
      refId: 'B',
    },
  ],
  dsSettings: mockDataSource(),
  onQueriesChange: function (queries: DataQuery[]): void {
    throw new Error('Function not implemented.');
  },
  onAddQuery: function (query: DataQuery): void {
    throw new Error('Function not implemented.');
  },
  onRunQueries: function (): void {
    throw new Error('Function not implemented.');
  },
  onUpdateDatasources: function (datasource: DataSourceRef): void {
    throw new Error('Function not implemented.');
  },
  data: createMockPanelData(),
};

describe('QueryEditorRows', () => {
  it('Should call onQueriesChange with skipAutoImport when replacing query', () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
    };

    const component = new QueryEditorRows(testProps);
    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'new-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    component.onReplaceQuery(replacementQuery, 0);

    expect(onQueriesChangeMock).toHaveBeenCalledWith(
      [
        { ...replacementQuery, refId: 'A' }, // preserves original refId
        props.queries[1], // second query unchanged
      ],
      { skipAutoImport: true }
    );
  });

  it('Should replace a single query with multiple queries in place, preserving the original refId for the first', () => {
    const onQueriesChangeMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: jest.fn(),
      onRunQueries: onRunQueriesMock,
    };

    const component = new QueryEditorRows(testProps);
    const replacements = [
      { refId: 'X', datasource: mockDS, expr: 'q1' },
      { refId: 'Y', datasource: mockDS, expr: 'q2' },
      { refId: 'Z', datasource: mockDS, expr: 'q3' },
    ];

    component.onReplaceQueries(replacements, 0);

    expect(onQueriesChangeMock).toHaveBeenCalledWith(
      [
        { ...replacements[0], refId: 'A' }, // first reuses the replaced query's refId
        { ...replacements[1], refId: 'C' }, // rest get fresh refIds that don't collide with B
        { ...replacements[2], refId: 'D' },
        props.queries[1], // second query (B) unchanged
      ],
      { skipAutoImport: true }
    );
    expect(onRunQueriesMock).toHaveBeenCalled();
  });

  it('Should be a no-op when replacing with an empty query list', () => {
    const onQueriesChangeMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const component = new QueryEditorRows({
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: jest.fn(),
      onRunQueries: onRunQueriesMock,
    });

    component.onReplaceQueries([], 0);

    expect(onQueriesChangeMock).not.toHaveBeenCalled();
    expect(onRunQueriesMock).not.toHaveBeenCalled();
  });

  it('Should switch to mixed datasource when replacing with multiple queries spanning datasources', () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: jest.fn(),
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [{ datasource: { uid: 'current-datasource', type: 'prometheus' }, refId: 'A' }],
    };

    const component = new QueryEditorRows(testProps);
    const replacements = [
      { refId: 'X', datasource: { uid: 'prom', type: 'prometheus' }, expr: 'q1' },
      { refId: 'Y', datasource: { uid: 'loki', type: 'loki' }, expr: 'q2' },
    ];

    component.onReplaceQueries(replacements, 0);

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({ uid: MIXED_DATASOURCE_NAME });
  });

  it('Should call onUpdateDatasources when replacing query with different datasource creates mixed scenario', () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [
        { datasource: { uid: 'current-datasource', type: 'alertmanager' }, refId: 'A' },
        { datasource: { uid: 'current-datasource', type: 'alertmanager' }, refId: 'B' },
      ],
      onRunQueries: onRunQueriesMock,
    };

    const component = new QueryEditorRows(testProps);
    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'different-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    component.onReplaceQuery(replacementQuery, 0);

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({
      uid: MIXED_DATASOURCE_NAME,
    });
  });

  it('Should call onUpdateDatasources when replacing query results in single different datasource', () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [{ datasource: { uid: 'current-datasource', type: 'alertmanager' }, refId: 'A' }],
    };

    const component = new QueryEditorRows(testProps);
    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'different-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    component.onReplaceQuery(replacementQuery, 0);

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({
      uid: 'different-datasource',
    });
  });

  it('Should not call onUpdateDatasources when replacing query with same datasource', () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
      dsSettings: { ...props.dsSettings, uid: 'same-datasource' },
      queries: [
        { datasource: { uid: 'same-datasource', type: 'prometheus' }, refId: 'A' },
        { datasource: { uid: 'same-datasource', type: 'prometheus' }, refId: 'B' },
      ],
    };

    const component = new QueryEditorRows(testProps);
    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'same-datasource', type: 'prometheus' },
      expr: 'new query content',
    };

    component.onReplaceQuery(replacementQuery, 0);

    expect(onUpdateDatasourcesMock).not.toHaveBeenCalled();
  });

  it('Should call onUpdateDatasources with mixed datasource when replacing creates mixed scenario', () => {
    const onQueriesChangeMock = jest.fn();
    const onUpdateDatasourcesMock = jest.fn();
    const onRunQueriesMock = jest.fn();

    const testProps = {
      ...props,
      onQueriesChange: onQueriesChangeMock,
      onUpdateDatasources: onUpdateDatasourcesMock,
      onRunQueries: onRunQueriesMock,
      dsSettings: { ...props.dsSettings, uid: 'current-datasource' },
      queries: [
        { datasource: { uid: 'datasource-1', type: 'loki' }, refId: 'A' },
        { datasource: { uid: 'datasource-2', type: 'test-data' }, refId: 'B' },
      ],
    };

    const component = new QueryEditorRows(testProps);
    const replacementQuery = {
      refId: 'A',
      datasource: { uid: 'datasource-3', type: 'prometheus' },
      expr: 'new query content',
    };

    component.onReplaceQuery(replacementQuery, 0);

    expect(onUpdateDatasourcesMock).toHaveBeenCalledWith({
      uid: MIXED_DATASOURCE_NAME,
    });
  });

  it('Should render queries', async () => {
    const {
      renderResult: { rerender },
    } = renderScenario();
    expect(await screen.findAllByTestId(selectors.components.QueryEditorRows.rows)).toHaveLength(2);

    rerender(
      <QueryEditorRows
        {...props}
        queries={[
          {
            datasource: mockDS,
            refId: 'A',
          },
        ]}
      />
    );

    expect(await screen.findAllByTestId(selectors.components.QueryEditorRows.rows)).toHaveLength(1);
  });

  it('Should mark each query row with the datasource plugin boundary', async () => {
    renderScenario();

    const rowA = await screen.findByTestId(
      selectors.components.Plugins.queryEditorRow(DataSourceType.Alertmanager, 'A')
    );
    expect(rowA).toHaveAttribute('data-plugin-id', DataSourceType.Alertmanager);
    expect(
      await screen.findByTestId(selectors.components.Plugins.queryEditorRow(DataSourceType.Alertmanager, 'B'))
    ).toBeInTheDocument();
  });

  it('Should be able to expand and collapse queries', async () => {
    renderScenario();
    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);

    for (const childQuery of queryEditorRows) {
      const toggleExpandButton = queryByLabelText(childQuery, 'Collapse query row') as HTMLElement;

      expect(toggleExpandButton).toBeInTheDocument();
      expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('true');

      fireEvent.click(toggleExpandButton);

      expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('Should have proper keyboard navigation for expand/collapse buttons', async () => {
    const user = userEvent.setup();
    renderScenario();
    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);

    for (const childQuery of queryEditorRows) {
      const toggleExpandButton = queryByLabelText(childQuery, 'Collapse query row') as HTMLElement;
      act(() => toggleExpandButton.focus());
      expect(toggleExpandButton).toHaveAttribute('aria-expanded', 'true');

      // Toggle with Enter
      await user.keyboard('{Enter}');
      expect(toggleExpandButton).toHaveAttribute('aria-expanded', 'false');

      // Toggle with Space
      await user.keyboard(' ');
      expect(toggleExpandButton).toHaveAttribute('aria-expanded', 'true');
    }
  });

  it('Should be able to duplicate queries', async () => {
    const onAddQuery = jest.fn();
    const onQueryCopied = jest.fn();

    renderScenario({ onAddQuery, onQueryCopied });
    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);
    queryEditorRows.map(async (childQuery) => {
      const duplicateQueryButton = queryByLabelText(childQuery, 'Duplicate query') as HTMLElement;

      expect(duplicateQueryButton).toBeInTheDocument();

      fireEvent.click(duplicateQueryButton);
    });

    expect(onAddQuery).toHaveBeenCalledTimes(queryEditorRows.length);
    expect(onQueryCopied).toHaveBeenCalledTimes(queryEditorRows.length);
  });

  it('Should be able to delete queries', async () => {
    const onQueriesChange = jest.fn();
    const onQueryRemoved = jest.fn();
    renderScenario({ onQueriesChange, onQueryRemoved });

    const queryEditorRows = await screen.findAllByTestId(selectors.components.QueryEditorRows.rows);
    queryEditorRows.map(async (childQuery) => {
      const deleteQueryButton = queryByLabelText(childQuery, 'Remove query') as HTMLElement;

      expect(deleteQueryButton).toBeInTheDocument();

      fireEvent.click(deleteQueryButton);
    });

    expect(onQueriesChange).toHaveBeenCalledTimes(queryEditorRows.length);
    expect(onQueryRemoved).toHaveBeenCalledTimes(queryEditorRows.length);
  });

  it('Should call getDefaultQuery when changing datasource with mixed datasource enabled', async () => {
    const onQueriesChangeMock = jest.fn();

    const mixedDsSettings = mockDataSource(
      { name: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME },
      { mixed: true }
    );

    const component = new QueryEditorRows({
      ...props,
      dsSettings: mixedDsSettings,
      onQueriesChange: onQueriesChangeMock,
    });

    const getDefaultQuery = jest.fn(() => ({ defaultFromDS: 'yes' }));
    // Mutate singleton dsSrvMock to return a datasource that has getDefaultQuery
    dsSrvMock.get = jest.fn(() => Promise.resolve({ getDefaultQuery } as unknown as DataSourceApi));
    dsSrvMock.getInstanceSettings = jest.fn(() => ({ ...mockDS, type: 'alertmanager' }));

    // Change to a different type than existing to trigger default query path
    const newDS = mockDataSource({ uid: 'prom', name: 'Prometheus', type: 'prometheus' });
    component.onDataSourceChange(newDS, 0);

    await waitFor(() => expect(onQueriesChangeMock).toHaveBeenCalled());

    const updatedQueries = onQueriesChangeMock.mock.calls[0][0] as Array<DataQuery & { defaultFromDS?: string }>;
    expect(updatedQueries[0].defaultFromDS).toBe('yes');
    expect(getDefaultQuery).toHaveBeenCalledTimes(1);
  });

  describe('datasource settings resolution', () => {
    const settingsCalls = () => jest.mocked(getDataSourceInstanceSettings).mock.calls.length;

    const panelRef = {
      resolve: () => ({ state: { key: 'panel-1' } }),
    } as NonNullable<Props['panelRef']>;

    const rowQueries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'ds-a', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'ds-b', type: 'loki' } },
    ];

    const baseProps: Props = {
      ...props,
      queries: rowQueries,
      onQueriesChange: jest.fn(),
      onAddQuery: jest.fn(),
      onRunQueries: jest.fn(),
      onUpdateDatasources: jest.fn(),
      panelRef,
    };

    beforeEach(() => {
      jest.mocked(getDataSourceInstanceSettings).mockClear();
    });

    afterEach(() => {
      mockReplace.mockImplementation((target?: string) => target ?? '');
      jest
        .mocked(getDataSourceInstanceSettings)
        .mockImplementation(async (...args: unknown[]) =>
          dsSrvMock.getInstanceSettings(...(args as Parameters<DataSourceSrv['getInstanceSettings']>))
        );
    });

    it('does not re-resolve settings when only panel data changes', async () => {
      const { rerender } = render(<QueryEditorRows {...baseProps} />);
      expect(await screen.findAllByTestId(selectors.components.QueryEditorRows.rows)).toHaveLength(2);

      const callsAfterMount = settingsCalls();

      await act(async () => {
        rerender(<QueryEditorRows {...baseProps} data={{ ...baseProps.data }} />);
      });

      expect(settingsCalls()).toBe(callsAfterMount);
    });

    it('does not re-resolve settings when query.datasource is a new object with the same uid', async () => {
      const { rerender } = render(<QueryEditorRows {...baseProps} />);
      expect(await screen.findAllByTestId(selectors.components.QueryEditorRows.rows)).toHaveLength(2);
      const callsAfterMount = settingsCalls();

      await act(async () => {
        rerender(
          <QueryEditorRows
            {...baseProps}
            queries={[
              { refId: 'A', datasource: { uid: 'ds-a', type: 'prometheus' } },
              { refId: 'B', datasource: { uid: 'ds-b', type: 'loki' } },
            ]}
          />
        );
      });

      expect(settingsCalls()).toBe(callsAfterMount);
    });

    it('re-resolves settings when query.datasource uid changes', async () => {
      const { rerender } = render(<QueryEditorRows {...baseProps} />);
      expect(await screen.findAllByTestId(selectors.components.QueryEditorRows.rows)).toHaveLength(2);
      const callsAfterMount = settingsCalls();

      await act(async () => {
        rerender(
          <QueryEditorRows
            {...baseProps}
            queries={[{ refId: 'A', datasource: { uid: 'ds-c', type: 'prometheus' } }, rowQueries[1]]}
          />
        );
      });

      expect(settingsCalls()).toBeGreaterThan(callsAfterMount);
    });

    it('re-resolves settings when a datasource variable interpolates to a new uid', async () => {
      let interpolatedUid = 'prom-uid';
      mockReplace.mockImplementation((target?: string) => (target === '${ds}' ? interpolatedUid : (target ?? '')));

      const variableQueries: DataQuery[] = [{ refId: 'A', datasource: { uid: '${ds}', type: 'prometheus' } }];
      const { rerender } = render(<QueryEditorRows {...baseProps} queries={variableQueries} />);
      expect(await screen.findByTestId(selectors.components.QueryEditorRows.rows)).toBeInTheDocument();
      const callsAfterMount = settingsCalls();

      interpolatedUid = 'loki-uid';
      await act(async () => {
        rerender(<QueryEditorRows {...baseProps} queries={variableQueries} data={{ ...baseProps.data }} />);
      });

      expect(settingsCalls()).toBeGreaterThan(callsAfterMount + 1);
    });

    it('does not re-resolve settings when panel data changes but the interpolated uid is unchanged', async () => {
      mockReplace.mockImplementation((target?: string) => (target === '${ds}' ? 'prom-uid' : (target ?? '')));

      const variableQueries: DataQuery[] = [{ refId: 'A', datasource: { uid: '${ds}', type: 'prometheus' } }];
      const { rerender } = render(<QueryEditorRows {...baseProps} queries={variableQueries} />);
      expect(await screen.findByTestId(selectors.components.QueryEditorRows.rows)).toBeInTheDocument();
      const callsAfterMount = settingsCalls();

      await act(async () => {
        rerender(<QueryEditorRows {...baseProps} queries={variableQueries} data={{ ...baseProps.data }} />);
      });

      expect(settingsCalls()).toBe(callsAfterMount);
    });

    it('renders a mixed-panel row when interpolation resolves the datasource by name', async () => {
      mockReplace.mockImplementation((target?: string) => (target === '${ds}' ? 'Prometheus' : (target ?? '')));

      const wrappedSettings = {
        ...mockDataSource({ name: 'Prometheus', uid: 'prom-uid', type: 'prometheus' }),
        name: '${ds}',
        uid: '${ds}',
        rawRef: { type: 'prometheus', uid: 'prom-uid' },
      };
      jest.mocked(getDataSourceInstanceSettings).mockResolvedValue(wrappedSettings);

      const mixedSettings = mockDataSource(
        { name: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME },
        { mixed: true }
      );

      render(
        <QueryEditorRows
          {...baseProps}
          dsSettings={mixedSettings}
          queries={[{ refId: 'A', datasource: { uid: '${ds}', type: 'prometheus' } }]}
        />
      );

      expect(await screen.findByTestId(selectors.components.QueryEditorRows.rows)).toBeInTheDocument();
    });

    it.each([
      {
        name: 'uses group settings when the query has no datasource of its own',
        queryDatasource: undefined,
        hasQuerySettings: false,
        mixed: true,
        expectQuerySettings: false,
        expectGroup: true,
      },
      {
        name: 'uses resolved query settings on a mixed panel',
        queryDatasource: { uid: 'prom' },
        hasQuerySettings: true,
        mixed: true,
        expectQuerySettings: true,
        expectGroup: false,
      },
      {
        name: 'does not use mixed group settings while query settings are missing',
        queryDatasource: { uid: 'prom' },
        hasQuerySettings: false,
        mixed: true,
        expectQuerySettings: false,
        expectGroup: false,
      },
      {
        name: 'falls back to non-mixed group settings when query settings are missing',
        queryDatasource: { uid: 'prom' },
        hasQuerySettings: false,
        mixed: false,
        expectQuerySettings: false,
        expectGroup: true,
      },
    ])('$name', ({ queryDatasource, hasQuerySettings, mixed, expectQuerySettings, expectGroup }) => {
      const groupSettings = mockDataSource(
        { name: mixed ? MIXED_DATASOURCE_NAME : 'Prometheus', uid: mixed ? MIXED_DATASOURCE_NAME : 'prom' },
        { mixed }
      );
      const resolved = hasQuerySettings ? mockDataSource({ name: 'Loki', uid: 'loki', type: 'loki' }) : undefined;

      const result = resolveRowDataSourceSettings(queryDatasource, resolved, groupSettings);

      if (expectQuerySettings) {
        expect(result).toBe(resolved);
      } else if (expectGroup) {
        expect(result).toBe(groupSettings);
      } else {
        expect(result).toBeUndefined();
      }
    });

    it('does not fall back to mixed group settings when query datasource resolution fails', async () => {
      jest.mocked(getDataSourceInstanceSettings).mockResolvedValue(undefined);

      const mixedSettings = mockDataSource(
        { name: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME },
        { mixed: true }
      );

      render(
        <QueryEditorRows
          {...baseProps}
          dsSettings={mixedSettings}
          queries={[{ refId: 'A', datasource: { uid: 'missing-ds', type: 'prometheus' } }]}
        />
      );

      await waitFor(() => {
        expect(getDataSourceInstanceSettings).toHaveBeenCalled();
      });

      expect(screen.queryByTestId(selectors.components.QueryEditorRows.rows)).not.toBeInTheDocument();
    });
  });
});

function renderScenario(overrides?: Partial<Props>) {
  Object.assign(props, overrides);

  return {
    renderResult: render(<QueryEditorRows {...props} />),
  };
}
