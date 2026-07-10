import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen, within } from '@testing-library/react';
import { type Props as AutoSizerProps } from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';

import {
  CoreApp,
  createTheme,
  type DataSourceApi,
  EventBusSrv,
  getDefaultTimeRange,
  LoadingState,
  PluginExtensionTypes,
  store,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, usePluginLinks } from '@grafana/runtime';
import { getTestFeatureFlagClient } from '@grafana/test-utils/unstable';
import { configureStore } from 'app/store/configureStore';

import { ContentOutlineContextProvider } from './ContentOutline/ContentOutlineContext';
import { Explore, type Props } from './Explore';
import { QueryLibraryContextProviderMock } from './QueryLibrary/mocks';
import { initialExploreState } from './state/main';
import { scanStopAction } from './state/query';
import { createEmptyQueryResponse, makeExplorePaneState } from './state/utils';

const resizeWindow = (x: number, y: number) => {
  global.innerWidth = x;
  global.innerHeight = y;
  global.dispatchEvent(new Event('resize'));
};

const makeEmptyQueryResponse = (loadingState: LoadingState) => {
  const baseEmptyResponse = createEmptyQueryResponse();

  baseEmptyResponse.request = {
    requestId: '1',
    intervalMs: 0,
    interval: '1s',
    panelId: 1,
    range: baseEmptyResponse.timeRange,
    scopedVars: {
      apps: {
        value: 'value',
        text: 'text',
      },
    },
    targets: [
      {
        refId: 'A',
      },
    ],
    timezone: 'UTC',
    app: CoreApp.Explore,
    startTime: 0,
  };

  baseEmptyResponse.state = loadingState;

  return baseEmptyResponse;
};

const dummyProps: Props = {
  setShowQueryInspector: (value: boolean) => {},
  showQueryInspector: false,
  queryFlowRefIds: [],
  setQueryFlowRefIds: (refIds: string[]) => {},
  logsResult: undefined,
  changeSize: jest.fn(),
  datasourceInstance: {
    meta: {
      metrics: true,
      logs: true,
    },
    components: {
      QueryEditorHelp: {},
    },
  } as DataSourceApi,
  exploreId: 'left',
  loading: false,
  modifyQueries: jest.fn(),
  scanStart: jest.fn(),
  scanStopAction: scanStopAction,
  setQueries: jest.fn(),
  queryKeys: [],
  queries: [],
  isLive: false,
  syncedTimes: false,
  updateTimeRange: jest.fn(),
  graphResult: [],
  timeZone: 'UTC',
  queryResponse: makeEmptyQueryResponse(LoadingState.NotStarted),
  addQueryRow: jest.fn(),
  theme: createTheme(),
  showMetrics: true,
  showLogs: true,
  showTable: true,
  showTrace: true,
  showCustom: true,
  showNodeGraph: true,
  showFlameGraph: true,
  splitOpen: jest.fn(),
  splitted: false,
  eventBus: new EventBusSrv(),
  showRawPrometheus: false,
  showLogsSample: false,
  logsSample: { enabled: false },
  setSupplementaryQueryEnabled: jest.fn(),
  correlationEditorDetails: undefined,
  correlationEditorHelperData: undefined,
  exploreActiveDS: {
    exploreToDS: [],
    dsToExplore: [],
  },
  changeDatasource: jest.fn(),
  compact: false,
  changeCompactMode: jest.fn(),
  queryLibraryRef: undefined,
  queriesChangedIndexAtRun: 0,
};
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      savedQueriesRBAC: false,
    },
  },
  getDataSourceSrv: () => ({
    get: () => Promise.resolve({}),
    getList: () => [],
    getInstanceSettings: () => {},
  }),
  usePluginLinks: jest.fn(() => ({ links: [] })),
}));

// `QueryRows` resolves each query row's datasource plugin via the (unmocked) plugin datasource
// registry, which isn't set up in this test file — stubbing it out keeps these tests focused on
// QueryFlow panel behavior instead of the full query-editor-row rendering pipeline (covered by
// QueryRows.test.tsx). SecondaryActions (Add query, Add from library) is a separate sibling
// component and renders normally.
jest.mock('./QueryRows', () => ({
  QueryRows: () => null,
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    hasPermission: () => true,
    isSignedIn: true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
  },
}));

// for the AutoSizer component to have a width
jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: AutoSizerProps) =>
    children({
      height: 1,
      scaledHeight: 1,
      scaledWidth: 1,
      width: 1,
    });
});

const usePluginLinksMock = jest.mocked(usePluginLinks);

const setup = (overrideProps?: Partial<Props>) => {
  const store = configureStore({
    explore: {
      ...initialExploreState,
      panes: {
        left: makeExplorePaneState(),
      },
    },
  });
  const exploreProps = { ...dummyProps, ...overrideProps };

  return render(
    <TestProvider store={store}>
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <ContentOutlineContextProvider>
          <Explore {...exploreProps} />
        </ContentOutlineContextProvider>
      </OpenFeatureProvider>
    </TestProvider>
  );
};

describe('Explore', () => {
  it('should not render no data with not started loading state', async () => {
    setup();

    // Wait for the Explore component to render
    await screen.findByTestId(selectors.components.DataSourcePicker.container);

    expect(screen.queryByTestId('explore-no-data')).not.toBeInTheDocument();
  });

  it('should render no data with done loading state', async () => {
    setup({ queryResponse: makeEmptyQueryResponse(LoadingState.Done) });

    // Wait for the Explore component to render
    await screen.findByTestId(selectors.components.DataSourcePicker.container);

    expect(screen.getByTestId('explore-no-data')).toBeInTheDocument();
  });

  it('should render toolbar extension point if extensions is available', async () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        {
          id: '1',
          pluginId: 'grafana',
          title: 'Test 1',
          description: '',
          type: PluginExtensionTypes.link,
          onClick: () => {},
        },
        {
          id: '2',
          pluginId: 'grafana',
          title: 'Test 2',
          description: '',
          type: PluginExtensionTypes.link,
          onClick: () => {},
        },
      ],
      isLoading: false,
    });

    setup({ queryResponse: makeEmptyQueryResponse(LoadingState.Done) });
    // Wait for the Explore component to render
    await screen.findByTestId(selectors.components.DataSourcePicker.container);

    expect(screen.getByRole('button', { name: 'Add' })).toBeVisible();
  });

  describe('On small screens', () => {
    const windowWidth = global.innerWidth,
      windowHeight = global.innerHeight;

    beforeAll(() => {
      resizeWindow(500, 500);
    });

    afterAll(() => {
      resizeWindow(windowWidth, windowHeight);
    });

    it('should render data source picker', async () => {
      setup();

      const dataSourcePicker = await screen.findByTestId(selectors.components.DataSourcePicker.container);

      expect(dataSourcePicker).toBeInTheDocument();
    });
  });

  describe('Content Outline', () => {
    it('should retrieve the last visible state from local storage', async () => {
      const getBoolMock = jest.spyOn(store, 'getBool').mockReturnValue(false);
      setup();
      const showContentOutlineButton = screen.queryByRole('button', { name: 'Collapse outline' });
      expect(showContentOutlineButton).not.toBeInTheDocument();
      getBoolMock.mockRestore();
    });
  });

  describe('Saved Queries Integration', () => {
    it('should enable add query buttons when queryLibraryRef is undefined', async () => {
      setup({ queryLibraryRef: undefined });

      // Wait for the Explore component to render
      await screen.findByTestId(selectors.components.DataSourcePicker.container);

      const addQueryButton = screen.getByRole('button', { name: /Add query$/i });
      expect(addQueryButton).toBeEnabled();
    });

    it('should disable add query buttons when queryLibraryRef is set (editing from library)', async () => {
      setup({ queryLibraryRef: 'library-query-123' });

      // Wait for the Explore component to render
      await screen.findByTestId(selectors.components.DataSourcePicker.container);

      const addQueryButton = screen.getByRole('button', { name: /Add query$/i });
      expect(addQueryButton).toBeDisabled();
    });

    it('should disable both add query and add from library buttons when editing from library', async () => {
      const store = configureStore({
        explore: {
          ...initialExploreState,
          panes: {
            left: makeExplorePaneState(),
          },
        },
      });
      const exploreProps = { ...dummyProps, queryLibraryRef: 'library-query-123' };

      render(
        <TestProvider store={store}>
          <OpenFeatureProvider client={getTestFeatureFlagClient()}>
            <QueryLibraryContextProviderMock queryLibraryEnabled={true}>
              <ContentOutlineContextProvider>
                <Explore {...exploreProps} />
              </ContentOutlineContextProvider>
            </QueryLibraryContextProviderMock>
          </OpenFeatureProvider>
        </TestProvider>
      );

      // Wait for the Explore component to render
      await screen.findByTestId(selectors.components.DataSourcePicker.container);

      const addQueryButton = screen.getByRole('button', { name: /Add query$/i });
      const addFromLibraryButton = screen.getByRole('button', { name: /Add from saved queries/i });

      expect(addQueryButton).toBeDisabled();
      expect(addFromLibraryButton).toBeDisabled();
    });
  });

  describe('Query flow', () => {
    const originalToggle = config.featureToggles.exploreQueryFlow;

    afterEach(() => {
      config.featureToggles.exploreQueryFlow = originalToggle;
    });

    const setupWithQueries = (queries: Array<{ refId: string; expr: string }>, overrideProps?: Partial<Props>) => {
      const dataQueries = queries.map((q) => ({ ...q, datasource: { type: 'prometheus', uid: 'prom' } }));
      const queryFlowStore = configureStore({
        explore: {
          ...initialExploreState,
          panes: {
            left: makeExplorePaneState({ queries: dataQueries, range: getDefaultTimeRange() }),
          },
        },
      });
      // `Explore` itself isn't connected in this test (imported un-wrapped), so its own `queries` prop
      // — which drives query-flow panel ordering — must be set explicitly, matching the store's.
      const exploreProps = { ...dummyProps, queries: dataQueries, ...overrideProps };
      return render(
        <TestProvider store={queryFlowStore}>
          <OpenFeatureProvider client={getTestFeatureFlagClient()}>
            <ContentOutlineContextProvider>
              <Explore {...exploreProps} />
            </ContentOutlineContextProvider>
          </OpenFeatureProvider>
        </TestProvider>
      );
    };

    it('does not render the query flow panel when the feature toggle is disabled, even with open refIds', async () => {
      config.featureToggles.exploreQueryFlow = false;
      setupWithQueries([{ refId: 'A', expr: 'rate(alpha_metric[5m])' }], { queryFlowRefIds: ['A'] });

      await screen.findByTestId(selectors.components.DataSourcePicker.container);
      expect(screen.queryByTestId('query-flow')).not.toBeInTheDocument();
    });

    it('mounts the query flow panel for an open refId once the feature toggle is enabled', async () => {
      config.featureToggles.exploreQueryFlow = true;
      setupWithQueries([{ refId: 'A', expr: 'rate(alpha_metric[5m])' }], { queryFlowRefIds: ['A'] });

      await screen.findByTestId(selectors.components.DataSourcePicker.container);
      const panel = await screen.findByTestId('query-flow');
      expect(within(panel).getByText('A')).toBeInTheDocument();
    });

    it('renders open panels in query-row order rather than the order refIds were opened', async () => {
      config.featureToggles.exploreQueryFlow = true;
      setupWithQueries(
        [
          { refId: 'A', expr: 'rate(alpha_metric[5m])' },
          { refId: 'B', expr: 'rate(beta_metric[5m])' },
        ],
        // Opened in reverse (B before A) — panels should still read top-to-bottom in row order.
        { queryFlowRefIds: ['B', 'A'] }
      );

      await screen.findByTestId(selectors.components.DataSourcePicker.container);
      const panels = await screen.findAllByTestId('query-flow');
      expect(panels).toHaveLength(2);
      expect(within(panels[0]).getByText('A')).toBeInTheDocument();
      expect(within(panels[1]).getByText('B')).toBeInTheDocument();
    });
  });
});
