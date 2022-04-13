import React from 'react';
import {
  DataSourceApi,
  LoadingState,
  toUtc,
  DataQueryError,
  DataQueryRequest,
  CoreApp,
  createTheme,
} from '@grafana/data';
import { render, screen } from '@testing-library/react';
import { ExploreId } from 'app/types/explore';
import { Explore, Props } from './Explore';
import { scanStopAction } from './state/query';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { AutoSizerProps } from 'react-virtualized-auto-sizer';

const makeEmptyQueryResponse = (loadingState: LoadingState) => {
  return {
    state: loadingState,
    series: [],
    request: {
      requestId: '1',
      dashboardId: 0,
      interval: '1s',
      panelId: 1,
      scopedVars: {
        apps: {
          value: 'value',
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
    } as unknown as DataQueryRequest,
    error: {} as DataQueryError,
    timeRange: {
      from: toUtc('2019-01-01 10:00:00'),
      to: toUtc('2019-01-01 16:00:00'),
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
    graphFrames: [],
    logsFrames: [],
    tableFrames: [],
    traceFrames: [],
    nodeGraphFrames: [],
    graphResult: null,
    logsResult: null,
    tableResult: null,
  };
};

const dummyProps: Props = {
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
  datasourceMissing: false,
  exploreId: ExploreId.left,
  loading: false,
  modifyQueries: jest.fn(),
  scanStart: jest.fn(),
  scanStopAction: scanStopAction,
  setQueries: jest.fn(),
  queryKeys: [],
  isLive: false,
  syncedTimes: false,
  updateTimeRange: jest.fn(),
  makeAbsoluteTime: jest.fn(),
  graphResult: [],
  absoluteRange: {
    from: 0,
    to: 0,
  },
  timeZone: 'UTC',
  queryResponse: makeEmptyQueryResponse(LoadingState.NotStarted),
  addQueryRow: jest.fn(),
  theme: createTheme(),
  showMetrics: true,
  showLogs: true,
  showTable: true,
  showTrace: true,
  showNodeGraph: true,
  splitOpen: (() => {}) as any,
  logsVolumeData: undefined,
  loadLogsVolumeData: () => {},
  changeGraphStyle: () => {},
  graphStyle: 'lines',
};

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      get: () => Promise.resolve({}),
      getList: () => [],
      getInstanceSettings: () => {},
    }),
  };
});

// for the AutoSizer component to have a width
jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: AutoSizerProps) => children({ height: 1, width: 1 });
});

const setup = (overrideProps?: Partial<Props>) => {
  const store = configureStore();
  const exploreProps = { ...dummyProps, ...overrideProps };

  return render(
    <Provider store={store}>
      <Explore {...exploreProps} />
    </Provider>
  );
};

describe('Explore', () => {
  it('should not render no data with not started loading state', () => {
    setup();
    expect(screen.queryByTestId('explore-no-data')).not.toBeInTheDocument();
  });

  it('should render no data with done loading state', async () => {
    const queryResp = makeEmptyQueryResponse(LoadingState.Done);
    setup({ queryResponse: queryResp });
    expect(screen.getByTestId('explore-no-data')).toBeInTheDocument();
  });
});
