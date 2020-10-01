import { MetaAnalyticsEventName, reportMetaAnalytics } from '@grafana/runtime';
import { CoreApp, DataQueryRequest, DataSourceApi, dateTime, LoadingState, PanelData } from '@grafana/data';
import { emitDataRequestEvent } from './analyticsProcessor';
import { DashboardModel } from './DashboardModel';

beforeEach(() => {
  jest.clearAllMocks();
});

const datasource = {
  name: 'test',
  id: 1,
} as DataSourceApi;

const dashboardModel = new DashboardModel(
  { id: 1, title: 'Test Dashboard', uid: 'test' },
  { folderTitle: 'Test Folder' }
);

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => dashboardModel,
    };
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as any),
  reportMetaAnalytics: jest.fn(),
}));

const mockGetUrlSearchParams = jest.fn(() => {
  return {};
});
jest.mock('@grafana/data', () => ({
  ...(jest.requireActual('@grafana/data') as any),
  urlUtil: {
    getUrlSearchParams: () => mockGetUrlSearchParams(),
  },
}));

function getTestData(requestApp: string): PanelData {
  const now = dateTime();
  return {
    request: {
      app: requestApp,
      dashboardId: 1,
      panelId: 2,
      startTime: now.unix(),
      endTime: now.add(1, 's').unix(),
    } as DataQueryRequest,
    series: [],
    state: LoadingState.Done,
    timeRange: {
      from: dateTime(),
      to: dateTime(),
      raw: { from: '1h', to: 'now' },
    },
  };
}

describe('emitDataRequestEvent - from a dashboard panel', () => {
  const data = getTestData(CoreApp.Dashboard);
  const fn = emitDataRequestEvent(datasource);
  it('Should report meta analytics', () => {
    fn(data);

    expect(reportMetaAnalytics).toBeCalledTimes(1);
    expect(reportMetaAnalytics).toBeCalledWith(
      expect.objectContaining({
        eventName: MetaAnalyticsEventName.DataRequest,
        datasourceName: datasource.name,
        datasourceId: datasource.id,
        panelId: 2,
        dashboardId: 1,
        dashboardName: 'Test Dashboard',
        dashboardUid: 'test',
        folderName: 'Test Folder',
        dataSize: 0,
        duration: 1,
      })
    );
  });

  it('Should not report meta analytics twice if the request receives multiple responses', () => {
    fn(data);
    expect(reportMetaAnalytics).not.toBeCalled();
  });

  it('Should not report meta analytics in edit mode', () => {
    mockGetUrlSearchParams.mockImplementationOnce(() => {
      return { editPanel: 2 };
    });
    emitDataRequestEvent(datasource)(data);
    expect(reportMetaAnalytics).not.toBeCalled();
  });
});

describe('emitDataRequestEvent - from Explore', () => {
  const data = getTestData(CoreApp.Explore);
  it('Should not report meta analytics', () => {
    emitDataRequestEvent(datasource)(data);
    expect(reportMetaAnalytics).not.toBeCalled();
  });
});
