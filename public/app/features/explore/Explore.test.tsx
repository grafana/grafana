import { render, screen } from '@testing-library/react';
import { Props as AutoSizerProps } from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import {
  CoreApp,
  createTheme,
  DataSourceApi,
  EventBusSrv,
  LoadingState,
  PluginExtensionTypes,
  store,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { usePluginLinks } from '@grafana/runtime';
import { configureStore as appConfigureStore } from 'app/store/configureStore';

import { ContentOutlineContextProvider } from './ContentOutline/ContentOutlineContext';
import { Explore, Props } from './Explore';
import { initialExploreState } from './state/main';
import { scanStopAction } from './state/query';
import { createEmptyQueryResponse, makeExplorePaneState } from './state/utils';
import { exploreReducer } from './state/main';

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
  compactMode: false,
};
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: () => Promise.resolve({}),
    getList: () => [],
    getInstanceSettings: () => {},
  }),
  usePluginLinks: jest.fn(() => ({ links: [] })),
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
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
  const store = appConfigureStore({
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
      <ContentOutlineContextProvider>
        <Explore {...exploreProps} />
      </ContentOutlineContextProvider>
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
});

describe('Explore Compact Mode', () => {
  it('should hide DrilldownAlertBox in compact mode when split view is active', () => {
    const leftPaneState = makeExplorePaneState();
    leftPaneState.datasourceInstance = { type: 'prometheus' } as any;
    leftPaneState.initialized = true;
    
    const rightPaneState = makeExplorePaneState();
    rightPaneState.datasourceInstance = { type: 'prometheus' } as any;
    rightPaneState.initialized = true;

    const storeWithSplitView = configureStore({
      reducer: {
        explore: exploreReducer,
        user: (state = { orgId: 1, timeZone: 'utc' }) => state,
      },
      preloadedState: {
        explore: {
          ...initialExploreState,
          panes: {
            'left-pane': leftPaneState,
            'right-pane': rightPaneState,
          },
          compactMode: true,
        },
      },
    });

    render(
      <Provider store={storeWithSplitView}>
        <Explore {...dummyProps} exploreId="left-pane" />
      </Provider>
    );

    // In compact mode with split view, DrilldownAlertBox should not be rendered
    expect(screen.queryByText('Explore Metrics, Logs, Traces and Profiles have moved!')).not.toBeInTheDocument();
  });

  it('should show DrilldownAlertBox when not in compact mode', () => {
    const testPaneState = makeExplorePaneState();
    testPaneState.datasourceInstance = { type: 'prometheus' } as any;
    testPaneState.initialized = true;

    const storeWithoutCompact = configureStore({
      reducer: {
        explore: exploreReducer,
        user: (state = { orgId: 1, timeZone: 'utc' }) => state,
      },
      preloadedState: {
        explore: {
          ...initialExploreState,
          panes: {
            'test-pane': testPaneState,
          },
          compactMode: false,
        },
      },
    });

    render(
      <Provider store={storeWithoutCompact}>
        <Explore {...dummyProps} />
      </Provider>
    );

    // Without compact mode, DrilldownAlertBox should be rendered
    expect(screen.getByText('Explore Metrics, Logs, Traces and Profiles have moved!')).toBeInTheDocument();
  });
});
