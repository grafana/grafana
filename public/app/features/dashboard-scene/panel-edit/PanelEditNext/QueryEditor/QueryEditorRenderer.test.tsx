import { act, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';

import {
  type DataQueryError,
  DataSourceApi,
  type DataSourceJsonData,
  type DataQueryResponse,
  getDefaultTimeRange,
  LoadingState,
  type QueryEditorCoauthoringCapability,
  type QueryEditorCoauthoringHostDescriptorV1,
  type TestDataSourceResponse,
} from '@grafana/data';
import { useFlagQueryeditorCoauthoringUi } from '@grafana/runtime/internal';
import { VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../constants';

import { QueryEditorProvider } from './QueryEditorContext';
import { QueryEditorPanel, QueryEditorRenderer } from './QueryEditorRenderer';
import {
  ds1SettingsMock,
  mockActions,
  mockQueryOptionsState,
  mockTransformToggles,
  mockTypeConfig,
  mockUIStateBase,
  renderWithQueryEditorProvider,
} from './testUtils';

jest.mock('app/features/query/components/QueryEditorRow', () => ({
  filterPanelDataToQuery: jest.fn(() => undefined),
}));

jest.mock('app/features/query/components/QueryErrorAlert', () => ({
  QueryErrorAlert: ({ error }: { error: DataQueryError }) => <div data-testid="query-error-alert">{error.message}</div>,
}));

const mockQueryCoauthoring = jest.fn();
jest.mock('./QueryCoauthoring', () => ({
  QueryCoauthoring: (props: unknown) => {
    mockQueryCoauthoring(props);
    return <button>Query with Assistant</button>;
  },
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagQueryeditorCoauthoringUi: jest.fn(),
}));

const mockedUseFlagQueryeditorCoauthoringUi = jest.mocked(useFlagQueryeditorCoauthoringUi);

interface TestQuery extends DataQuery {
  legendFormat?: string;
}

function getLegendFormat(query: DataQuery): string {
  return 'legendFormat' in query && typeof query.legendFormat === 'string' ? query.legendFormat : '';
}

// Fake query editor that simulates an uncontrolled input — it initialises its
// display value from props.query on mount and never syncs again.
function UncontrolledQueryEditor({ query }: { query: DataQuery }) {
  const [legend] = useState(getLegendFormat(query));
  return <div data-testid="query-editor-legend">{legend}</div>;
}

class MockDataSourceApi extends DataSourceApi<DataQuery, DataSourceJsonData> {
  constructor(components: DataSourceApi<DataQuery, DataSourceJsonData>['components']) {
    super(ds1SettingsMock);
    this.components = components;
  }

  query(): Promise<DataQueryResponse> {
    return Promise.resolve({ data: [] });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: 'OK' });
  }
}

const selectedQueryDsData = {
  datasource: new MockDataSourceApi({ QueryEditor: UncontrolledQueryEditor }),
  dsSettings: ds1SettingsMock,
};

const queryA: TestQuery = { refId: 'A', legendFormat: 'series-a' };
const queryB: TestQuery = { refId: 'B', legendFormat: 'series-b' };

function renderRenderer(
  selectedQuery: DataQuery | null,
  uiStateOverrides: NonNullable<Parameters<typeof renderWithQueryEditorProvider>[1]>['uiStateOverrides'] = {}
) {
  return renderWithQueryEditorProvider(<QueryEditorRenderer />, {
    queries: [queryA, queryB],
    selectedQuery,
    uiStateOverrides: { selectedQueryDsData, ...uiStateOverrides },
  });
}

describe('QueryEditorRenderer', () => {
  beforeEach(() => {
    mockQueryCoauthoring.mockClear();
    mockedUseFlagQueryeditorCoauthoringUi.mockReturnValue(false);
  });

  it('renders nothing when no query is selected', () => {
    renderRenderer(null);
    expect(screen.queryByTestId('query-editor-legend')).not.toBeInTheDocument();
  });

  it('shows a loading spinner while the datasource is loading', () => {
    renderRenderer(queryA, { selectedQueryDsLoading: true, selectedQueryDsData: null });
    expect(screen.getByText(/loading datasource/i)).toBeInTheDocument();
  });

  it('shows an actionable error when the datasource fails to load', () => {
    renderRenderer(queryA, { selectedQueryDsData: null });
    expect(screen.getByText(/failed to load datasource for this query/i)).toBeInTheDocument();
    expect(screen.getByText(/select a datasource for this query/i)).toBeInTheDocument();
  });

  it('renders the query editor for the selected query', () => {
    renderRenderer(queryA);
    expect(screen.getByTestId('query-editor-legend')).toHaveTextContent('series-a');
  });

  it('does not offer the coauthoring capability registrar when the feature flag is disabled', () => {
    function CapabilityQueryEditor(props: {
      query: DataQuery;
      onRegisterQueryEditorCoauthoring?: (capability: QueryEditorCoauthoringCapability) => void;
    }) {
      expect(props.onRegisterQueryEditorCoauthoring).toBeUndefined();
      return <div data-testid="capability-query-editor" />;
    }

    renderRenderer(queryA, {
      selectedQueryDsData: {
        datasource: new MockDataSourceApi({ QueryEditor: CapabilityQueryEditor }),
        dsSettings: ds1SettingsMock,
      },
    });

    expect(screen.queryByRole('button', { name: /query with assistant/i })).not.toBeInTheDocument();
  });

  it('renders the coauthoring entry point only after a flagged editor registers its capability', () => {
    mockedUseFlagQueryeditorCoauthoringUi.mockReturnValue(true);

    function CapabilityQueryEditor(props: {
      query: DataQuery;
      onRegisterQueryEditorCoauthoring?: (capability: QueryEditorCoauthoringCapability | undefined) => void;
    }) {
      const { onRegisterQueryEditorCoauthoring, query } = props;
      useEffect(() => {
        onRegisterQueryEditorCoauthoring?.({
          getValue: () => query.refId,
          getContext: async () => ({ query: query.refId, focusRanges: [], metricMetadata: [] }),
          refreshContext: async () => ({ query: query.refId, focusRanges: [], metricMetadata: [] }),
          createQuery: (value) => ({ ...query, refId: value }),
          validateQuery: () => true,
          stagePreview: () => ({ changes: [] }),
          clearPreview: jest.fn(),
          subscribeToInvocation: () => jest.fn(),
          focus: jest.fn(),
        });
        return () => onRegisterQueryEditorCoauthoring?.(undefined);
      }, [onRegisterQueryEditorCoauthoring, query]);

      return <div data-testid="capability-query-editor" />;
    }

    renderRenderer(queryA, {
      selectedQueryDsData: {
        datasource: new MockDataSourceApi({ QueryEditor: CapabilityQueryEditor }),
        dsSettings: ds1SettingsMock,
      },
    });

    expect(screen.getByRole('button', { name: /query with assistant/i })).toBeInTheDocument();
  });

  it('uses a new pending generation for another query and ignores lifecycle events from the prior generation', () => {
    mockedUseFlagQueryeditorCoauthoringUi.mockReturnValue(true);
    const hosts: QueryEditorCoauthoringHostDescriptorV1[] = [];
    function HostAwareQueryEditor({
      queryEditorCoauthoringHost,
    }: {
      queryEditorCoauthoringHost?: QueryEditorCoauthoringHostDescriptorV1;
    }) {
      if (queryEditorCoauthoringHost) {
        hosts.push(queryEditorCoauthoringHost);
      }
      return <div data-testid="host-aware-query-editor" />;
    }
    const queryDsData = {
      datasource: new MockDataSourceApi({ QueryEditor: HostAwareQueryEditor }),
      dsSettings: ds1SettingsMock,
    };
    const renderPanel = (query: DataQuery) => (
      <QueryEditorPanel
        query={query}
        queryDsData={queryDsData}
        queryDsLoading={false}
        queries={[queryA, queryB]}
        updateQuery={jest.fn()}
        addQuery={jest.fn()}
        runQueries={jest.fn()}
      />
    );
    const { rerender } = render(renderPanel(queryA));
    const firstHost = hosts.at(-1)!;

    act(() => firstHost.onSurfaceStateChange({ generation: firstHost.generation, state: 'ready' }));
    expect(hosts.at(-1)?.surfaceState).toBe('ready');

    rerender(renderPanel(queryB));
    const secondHost = hosts.at(-1)!;
    expect(secondHost.generation).not.toBe(firstHost.generation);
    expect(secondHost.surfaceState).toBe('pending');

    act(() => firstHost.onSurfaceStateChange({ generation: firstHost.generation, state: 'failed' }));
    expect(hosts.at(-1)?.surfaceState).toBe('pending');
  });

  it('runs a proposed query while keeping the baseline in the editor and coordinates revert and accept', () => {
    mockedUseFlagQueryeditorCoauthoringUi.mockReturnValue(true);
    const updateQuery = jest.fn();
    const runQueries = jest.fn();
    const proposedQuery = { ...queryA, legendFormat: 'proposed' };

    function CapabilityQueryEditor(props: {
      query: DataQuery;
      queries?: DataQuery[];
      onRegisterQueryEditorCoauthoring?: (capability: QueryEditorCoauthoringCapability | undefined) => void;
    }) {
      const { onRegisterQueryEditorCoauthoring, query, queries } = props;
      useEffect(() => {
        onRegisterQueryEditorCoauthoring?.({
          getValue: () => query.refId,
          getContext: async () => ({ query: query.refId, focusRanges: [], metricMetadata: [] }),
          refreshContext: async () => ({ query: query.refId, focusRanges: [], metricMetadata: [] }),
          createQuery: (value) => ({ ...query, refId: value }),
          validateQuery: () => true,
          stagePreview: () => ({ changes: [] }),
          clearPreview: jest.fn(),
          subscribeToInvocation: () => jest.fn(),
          focus: jest.fn(),
        });
        return () => onRegisterQueryEditorCoauthoring?.(undefined);
      }, [onRegisterQueryEditorCoauthoring, query]);

      return (
        <div data-testid="preview-editor">{`${getLegendFormat(query)}:${queries?.[0] ? getLegendFormat(queries[0]) : ''}`}</div>
      );
    }

    const queryDsData = {
      datasource: new MockDataSourceApi({ QueryEditor: CapabilityQueryEditor }),
      dsSettings: ds1SettingsMock,
    };
    const renderPanel = (query: DataQuery, queries: DataQuery[]) => (
      <QueryEditorPanel
        query={query}
        queryDsData={queryDsData}
        queryDsLoading={false}
        queries={queries}
        updateQuery={updateQuery}
        addQuery={jest.fn()}
        runQueries={runQueries}
      />
    );
    const { rerender } = render(renderPanel(queryA, [queryA, queryB]));
    const coauthoringProps = mockQueryCoauthoring.mock.lastCall?.[0] as {
      onAccept: (query: DataQuery, baselineRevision?: string) => void;
      onPreview: (query: DataQuery, baselineRevision?: string) => void;
      onRevertPreview: () => void;
    };

    act(() => coauthoringProps.onPreview(proposedQuery, 'revision-1'));
    expect(updateQuery).toHaveBeenCalledWith(proposedQuery, 'A');
    expect(runQueries).toHaveBeenCalledTimes(1);

    rerender(renderPanel(proposedQuery, [proposedQuery, queryB]));
    expect(screen.getByTestId('preview-editor')).toHaveTextContent('series-a:series-a');

    act(() => coauthoringProps.onAccept(proposedQuery, 'obsolete-revision'));
    expect(updateQuery).toHaveBeenLastCalledWith(proposedQuery, 'A');

    act(() => coauthoringProps.onRevertPreview());
    expect(updateQuery).toHaveBeenLastCalledWith(queryA, 'A');
    expect(runQueries).toHaveBeenCalledTimes(2);

    rerender(renderPanel(queryA, [queryA, queryB]));
    act(() => coauthoringProps.onPreview(proposedQuery));
    rerender(renderPanel(proposedQuery, [proposedQuery, queryB]));
    expect(screen.getByTestId('preview-editor')).toHaveTextContent('series-a:series-a');

    act(() => coauthoringProps.onAccept(proposedQuery));
    rerender(renderPanel(proposedQuery, [proposedQuery, queryB]));
    expect(screen.getByTestId('preview-editor')).toHaveTextContent('proposed:proposed');
    expect(runQueries).toHaveBeenCalledTimes(3);
  });

  it('contains errors thrown by the datasource query editor', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    function ThrowingQueryEditor(): never {
      throw new Error('Query editor crashed');
    }

    try {
      renderRenderer(queryA, {
        selectedQueryDsData: {
          datasource: new MockDataSourceApi({ QueryEditor: ThrowingQueryEditor }),
          dsSettings: ds1SettingsMock,
        },
      });

      expect(screen.getByText('An unexpected error happened')).toBeInTheDocument();
      expect(screen.getByText(/Query editor crashed/)).toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('remounts the query editor when switching queries, resetting uncontrolled input state', () => {
    // Regression test: datasource plugin editors (e.g. Loki) use uncontrolled
    // inputs (defaultValue) for options like Legend. Without a `key` prop on
    // the QueryEditorComponent, React reuses the mounted instance when
    // switching queries and the DOM values stay stale from the previous query.
    //
    // Example: user edits Legend on query A → "foo", switches to query B which
    // has legendFormat "bar" — without the fix the Legend field still shows "foo".

    // RTL's rerender requires a full ReactElement, so we construct the provider
    // tree directly here rather than going through renderWithQueryEditorProvider.
    function buildJsx(selectedQuery: DataQuery) {
      return (
        <QueryEditorProvider
          dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
          qrState={{ queries: [queryA, queryB], data: undefined, queryError: undefined }}
          panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [] }}
          alertingState={{ alertRules: [], loading: false, isDashboardSaved: true }}
          uiState={{
            selectedQuery,
            selectedTransformation: null,
            selectedAlert: null,
            setSelectedQuery: jest.fn(),
            setSelectedTransformation: jest.fn(),
            setSelectedAlert: jest.fn(),
            queryOptions: mockQueryOptionsState,
            selectedQueryDsData,
            selectedQueryDsLoading: false,
            showingDatasourceHelp: false,
            toggleDatasourceHelp: jest.fn(),
            transformToggles: mockTransformToggles,
            cardType: QueryEditorType.Query,
            pendingExpression: null,
            setPendingExpression: jest.fn(),
            finalizePendingExpression: jest.fn(),
            pendingTransformation: null,
            setPendingTransformation: jest.fn(),
            finalizePendingTransformation: jest.fn(),
            pendingSavedQuery: null,
            setPendingSavedQuery: jest.fn(),
            showVersionBanner: false,
            selectedQueryRefIds: [],
            selectedTransformationIds: [],
            multiSelectMode: false,
            setMultiSelectMode: jest.fn(),
            toggleQuerySelection: jest.fn(),
            toggleTransformationSelection: jest.fn(),
            clearSelection: jest.fn(),
            stackedMode: mockUIStateBase.stackedMode,
            confirmingDeleteActionKey: null,
            setConfirmingDeleteActionKey: jest.fn(),
          }}
          actions={mockActions}
          typeConfig={mockTypeConfig}
        >
          <QueryEditorRenderer />
        </QueryEditorProvider>
      );
    }

    const { rerender } = render(buildJsx(queryA));
    expect(screen.getByTestId('query-editor-legend')).toHaveTextContent('series-a');

    rerender(buildJsx(queryB));

    // Must show series-b, not the stale series-a value from query A's editor instance
    expect(screen.getByTestId('query-editor-legend')).toHaveTextContent('series-b');
  });

  it('applies onChange called from a useEffect cleanup when switching away from a query', async () => {
    const updateSelectedQuery = jest.fn();

    // Editor that flushes a pending edit via onChange in its unmount cleanup.
    function CleanupOnChangeEditor({ query, onChange }: { query: DataQuery; onChange: (q: DataQuery) => void }) {
      const pendingEdit = { ...query, legendFormat: `${getLegendFormat(query)}-edited` };
      const pendingEditRef = useRef(pendingEdit);
      pendingEditRef.current = pendingEdit;
      const onChangeRef = useRef(onChange);
      onChangeRef.current = onChange;

      useEffect(() => {
        return () => onChangeRef.current(pendingEditRef.current);
      }, []);

      return <div data-testid="cleanup-editor">{getLegendFormat(query)}</div>;
    }

    const mockDatasourceWithCleanup = new MockDataSourceApi({ QueryEditor: CleanupOnChangeEditor });

    function buildJsx(selectedQuery: DataQuery) {
      return (
        <QueryEditorProvider
          dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
          qrState={{ queries: [queryA, queryB], data: undefined, queryError: undefined }}
          panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [] }}
          alertingState={{ alertRules: [], loading: false, isDashboardSaved: true }}
          uiState={{
            selectedQuery,
            selectedTransformation: null,
            selectedAlert: null,
            setSelectedQuery: jest.fn(),
            setSelectedTransformation: jest.fn(),
            setSelectedAlert: jest.fn(),
            queryOptions: mockQueryOptionsState,
            selectedQueryDsData: {
              datasource: mockDatasourceWithCleanup,
              dsSettings: ds1SettingsMock,
            },
            selectedQueryDsLoading: false,
            showingDatasourceHelp: false,
            toggleDatasourceHelp: jest.fn(),
            transformToggles: mockTransformToggles,
            cardType: QueryEditorType.Query,
            pendingExpression: null,
            setPendingExpression: jest.fn(),
            finalizePendingExpression: jest.fn(),
            pendingTransformation: null,
            setPendingTransformation: jest.fn(),
            finalizePendingTransformation: jest.fn(),
            pendingSavedQuery: null,
            setPendingSavedQuery: jest.fn(),
            showVersionBanner: false,
            selectedQueryRefIds: [],
            selectedTransformationIds: [],
            multiSelectMode: false,
            setMultiSelectMode: jest.fn(),
            toggleQuerySelection: jest.fn(),
            toggleTransformationSelection: jest.fn(),
            clearSelection: jest.fn(),
            stackedMode: mockUIStateBase.stackedMode,
            confirmingDeleteActionKey: null,
            setConfirmingDeleteActionKey: jest.fn(),
          }}
          actions={{ ...mockActions, updateSelectedQuery }}
          typeConfig={mockTypeConfig}
        >
          <QueryEditorRenderer />
        </QueryEditorProvider>
      );
    }

    const { rerender } = render(buildJsx(queryA));

    await act(async () => {
      rerender(buildJsx(queryB));
    });

    expect(updateSelectedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ refId: 'A', legendFormat: 'series-a-edited' }),
      'A'
    );
  });

  it('shows an error when the query has an error', () => {
    renderWithQueryEditorProvider(<QueryEditorRenderer />, {
      queries: [queryA, queryB],
      selectedQuery: queryA,
      uiStateOverrides: { selectedQueryDsData },
      qrState: {
        data: {
          state: LoadingState.Error,
          series: [],
          timeRange: getDefaultTimeRange(),
          errors: [{ message: 'Error!!', refId: queryA.refId }],
        },
      },
    });

    expect(screen.getByText('Error!!')).toBeInTheDocument();
  });
});
