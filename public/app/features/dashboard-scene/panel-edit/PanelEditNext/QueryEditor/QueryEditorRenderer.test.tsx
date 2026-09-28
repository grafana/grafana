import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type PropsWithChildren, type ReactElement, useEffect, useRef, useState } from 'react';

import {
  type DataQueryError,
  DataSourceApi,
  type DataSourceJsonData,
  type DataQueryResponse,
  getDefaultTimeRange,
  LoadingState,
  type TestDataSourceResponse,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FlagKeys } from '@grafana/runtime/internal';
import { VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { QueryEditorType } from '../constants';

import { QueryEditorProvider } from './QueryEditorContext';
import { QueryEditorPanel, QueryEditorRenderer } from './QueryEditorRenderer';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringRegistrationV1,
} from './coauthoring/internalCoauthoringContract';
import { synchronizeCoauthoringBaselineQuery } from './coauthoring/useQueryProposalTransaction';
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
  constructor(components: DataSourceApi<DataQuery, DataSourceJsonData>['components'], settings = ds1SettingsMock) {
    super(settings);
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

function renderWithOpenFeature(ui: ReactElement) {
  function Wrapper({ children }: PropsWithChildren) {
    return <OpenFeatureProvider client={getTestFeatureFlagClient()}>{children}</OpenFeatureProvider>;
  }

  return render(ui, { wrapper: Wrapper });
}

describe('QueryEditorRenderer', () => {
  beforeEach(() => {
    setTestFlags({ [FlagKeys.QueryeditorCoauthoringUi]: false });
  });

  afterAll(() => {
    setTestFlags({});
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

  it('does not enable query coauthoring when the feature flag is disabled', () => {
    function CapabilityQueryEditor(props: { query: DataQuery; unstable_queryEditorCoauthoringV1?: object }) {
      expect(props.unstable_queryEditorCoauthoringV1).toBeUndefined();
      return <div data-testid="capability-query-editor" />;
    }

    renderRenderer(queryA, {
      selectedQueryDsData: {
        datasource: new MockDataSourceApi({ QueryEditor: CapabilityQueryEditor }),
        dsSettings: { ...ds1SettingsMock, type: 'prometheus' },
      },
    });

    expect(screen.getByTestId('capability-query-editor')).toBeInTheDocument();
  });

  it('provides the datasource coauthoring registrar when the feature flag is enabled', () => {
    setTestFlags({ [FlagKeys.QueryeditorCoauthoringUi]: true });

    function CapabilityQueryEditor(props: {
      query: DataQuery;
      unstable_queryEditorCoauthoringV1?: QueryEditorCoauthoringRegistrationV1;
    }) {
      expect(props.unstable_queryEditorCoauthoringV1).toEqual({ register: expect.any(Function) });
      return <div data-testid="capability-query-editor" />;
    }

    renderRenderer(queryA, {
      selectedQueryDsData: {
        datasource: new MockDataSourceApi({ QueryEditor: CapabilityQueryEditor }),
        dsSettings: { ...ds1SettingsMock, type: 'prometheus' },
      },
    });

    expect(screen.getByTestId('capability-query-editor')).toBeInTheDocument();
  });

  it('does not offer the private coauthoring seam to a second datasource', () => {
    setTestFlags({ [FlagKeys.QueryeditorCoauthoringUi]: true });

    function OtherDatasourceQueryEditor(props: { query: DataQuery; unstable_queryEditorCoauthoringV1?: object }) {
      expect(props.unstable_queryEditorCoauthoringV1).toBeUndefined();
      return <div data-testid="other-datasource-query-editor" />;
    }

    renderRenderer(queryA, {
      selectedQueryDsData: {
        datasource: new MockDataSourceApi({ QueryEditor: OtherDatasourceQueryEditor }),
        dsSettings: ds1SettingsMock,
      },
    });

    expect(screen.getByTestId('other-datasource-query-editor')).toBeInTheDocument();
  });

  it('registers the row-scoped adapter and renders its selection trigger in Core', async () => {
    setTestFlags({ [FlagKeys.QueryeditorCoauthoringUi]: true });
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const snapshot = { mode: 'selection' as const, portalTarget };
    const adapter: QueryEditorCoauthoringAdapterV1 = {
      getSnapshot: () => snapshot,
      subscribe: () => () => undefined,
      invoke: jest.fn(),
      readInvocation: jest.fn(),
      prepareProposal: jest.fn(),
      dismiss: jest.fn(),
    };

    function CapabilityQueryEditor({
      unstable_queryEditorCoauthoringV1,
    }: {
      query: DataQuery;
      unstable_queryEditorCoauthoringV1?: QueryEditorCoauthoringRegistrationV1;
    }) {
      useEffect(() => unstable_queryEditorCoauthoringV1?.register(adapter), [unstable_queryEditorCoauthoringV1]);
      return <div data-testid="capability-query-editor" />;
    }

    const view = renderRenderer(queryA, {
      selectedQueryDsData: {
        datasource: new MockDataSourceApi({ QueryEditor: CapabilityQueryEditor }),
        dsSettings: { ...ds1SettingsMock, type: 'prometheus' },
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Explain or modify/ }));

    expect(adapter.invoke).toHaveBeenCalledTimes(1);
    expect(portalTarget).toContainElement(
      screen.getByTestId(selectors.components.QueryEditorCoauthoring.selectionToolbar)
    );

    view.unmount();
    portalTarget.remove();
  });

  it('synchronizes only a baseline that differs from the current query', () => {
    const updateQuery = jest.fn();
    const currentQuery: TestQuery = { refId: 'A', legendFormat: 'series-a' };
    const equalBaseline: TestQuery = { refId: 'A', legendFormat: 'series-a' };
    const differentBaseline: TestQuery = { refId: 'A', legendFormat: 'series-b' };
    const staleBaseline: TestQuery = { refId: 'B', legendFormat: 'series-c' };

    expect(synchronizeCoauthoringBaselineQuery(currentQuery, equalBaseline, updateQuery)).toBe(true);
    expect(updateQuery).not.toHaveBeenCalled();

    expect(synchronizeCoauthoringBaselineQuery(currentQuery, differentBaseline, updateQuery)).toBe(true);
    expect(updateQuery).toHaveBeenCalledWith({ refId: 'A', legendFormat: 'series-b' }, 'A');

    updateQuery.mockClear();
    expect(synchronizeCoauthoringBaselineQuery(currentQuery, staleBaseline, updateQuery)).toBe(false);
    expect(updateQuery).not.toHaveBeenCalled();
  });

  it('remounts the query editor when the datasource instance changes', () => {
    function InstanceAwareQueryEditor({ datasource }: { datasource: DataSourceApi }) {
      const [initialDatasourceUid] = useState(datasource.uid);
      return <div data-testid="datasource-instance">{initialDatasourceUid}</div>;
    }

    const firstSettings = { ...ds1SettingsMock, uid: 'prometheus-first' };
    const secondSettings = { ...ds1SettingsMock, uid: 'prometheus-second' };
    const renderPanel = (settings: typeof ds1SettingsMock) => (
      <QueryEditorPanel
        query={queryA}
        queryDsData={{
          datasource: new MockDataSourceApi({ QueryEditor: InstanceAwareQueryEditor }, settings),
          dsSettings: settings,
        }}
        queryDsLoading={false}
        queries={[queryA, queryB]}
        updateQuery={jest.fn()}
        addQuery={jest.fn()}
        runQueries={jest.fn()}
        startQueryPreview={jest.fn()}
      />
    );

    const view = renderWithOpenFeature(renderPanel(firstSettings));
    expect(screen.getByTestId('datasource-instance')).toHaveTextContent('prometheus-first');

    view.rerender(renderPanel(secondSettings));
    expect(screen.getByTestId('datasource-instance')).toHaveTextContent('prometheus-second');
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

    const { rerender } = renderWithOpenFeature(buildJsx(queryA));
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

    const { rerender } = renderWithOpenFeature(buildJsx(queryA));

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
