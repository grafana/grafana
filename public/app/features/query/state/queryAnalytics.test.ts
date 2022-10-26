import { CoreApp, DataFrame, DataQueryRequest, DataSourceApi, dateTime, LoadingState, PanelData } from '@grafana/data';
import { MetaAnalyticsEventName, reportMetaAnalytics } from '@grafana/runtime';

import { DashboardModel } from '../../dashboard/state';

import { emitDataRequestEvent } from './queryAnalytics';

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
  ...jest.requireActual('@grafana/runtime'),
  reportMetaAnalytics: jest.fn(),
}));

const mockGetUrlSearchParams = jest.fn(() => {
  return {};
});
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  urlUtil: {
    getUrlSearchParams: () => mockGetUrlSearchParams(),
  },
}));

const partiallyCachedSeries = [
  {
    refId: 'A',
    meta: {
      isCachedResponse: true,
    },
    fields: [],
    length: 0,
  },
  {
    refId: 'B',
    fields: [],
    length: 0,
  },
];

const multipleDataframesWithSameRefId = [
  {
    refId: 'A',
    meta: {
      isCachedResponse: true,
    },
    fields: [],
    length: 0,
  },
  {
    refId: 'A',
    fields: [],
    length: 0,
  },
];

function getTestData(requestApp: string, series: DataFrame[] = []): PanelData {
  const now = dateTime();
  return {
    request: {
      app: requestApp,
      dashboardId: 1,
      panelId: 2,
      startTime: now.unix(),
      endTime: now.add(1, 's').unix(),
    } as DataQueryRequest,
    series,
    state: LoadingState.Done,
    timeRange: {
      from: dateTime(),
      to: dateTime(),
      raw: { from: '1h', to: 'now' },
    },
  };
}

describe('emitDataRequestEvent - from a dashboard panel', () => {
  it('Should report meta analytics', () => {
    const data = getTestData(CoreApp.Dashboard);
    emitDataRequestEvent(datasource)(data);

    expect(reportMetaAnalytics).toBeCalledTimes(1);
    expect(reportMetaAnalytics).toBeCalledWith(
      expect.objectContaining({
        eventName: MetaAnalyticsEventName.DataRequest,
        datasourceName: datasource.name,
        datasourceId: datasource.id,
        datasourceUid: datasource.uid,
        panelId: 2,
        dashboardId: 1,
        dashboardName: 'Test Dashboard',
        dashboardUid: 'test',
        folderName: 'Test Folder',
        dataSize: 0,
        duration: 1,
        totalQueries: 0,
        cachedQueries: 0,
      })
    );
  });

  it('Should report meta analytics with counts for cached and total queries', () => {
    const data = getTestData(CoreApp.Dashboard, partiallyCachedSeries);
    emitDataRequestEvent(datasource)(data);

    expect(reportMetaAnalytics).toBeCalledTimes(1);
    expect(reportMetaAnalytics).toBeCalledWith(
      expect.objectContaining({
        eventName: MetaAnalyticsEventName.DataRequest,
        datasourceName: datasource.name,
        datasourceId: datasource.id,
        datasourceUid: datasource.uid,
        panelId: 2,
        dashboardId: 1,
        dashboardName: 'Test Dashboard',
        dashboardUid: 'test',
        folderName: 'Test Folder',
        dataSize: 2,
        duration: 1,
        totalQueries: 2,
        cachedQueries: 1,
      })
    );
  });

  it('Should report meta analytics with counts for cached and total queries when same refId spread across multiple DataFrames', () => {
    const data = getTestData(CoreApp.Dashboard, multipleDataframesWithSameRefId);
    emitDataRequestEvent(datasource)(data);

    expect(reportMetaAnalytics).toBeCalledTimes(1);
    expect(reportMetaAnalytics).toBeCalledWith(
      expect.objectContaining({
        eventName: MetaAnalyticsEventName.DataRequest,
        datasourceName: datasource.name,
        datasourceId: datasource.id,
        datasourceUid: datasource.uid,
        panelId: 2,
        dashboardId: 1,
        dashboardName: 'Test Dashboard',
        dashboardUid: 'test',
        folderName: 'Test Folder',
        dataSize: 2,
        duration: 1,
        totalQueries: 1,
        cachedQueries: 1,
      })
    );
  });

  it('Should not report meta analytics twice if the request receives multiple responses', () => {
    const data = getTestData(CoreApp.Dashboard);
    const fn = emitDataRequestEvent(datasource);
    fn(data);
    fn(data);
    expect(reportMetaAnalytics).toBeCalledTimes(1);
  });

  it('Should not report meta analytics in edit mode', () => {
    mockGetUrlSearchParams.mockImplementationOnce(() => {
      return { editPanel: 2 };
    });
    const data = getTestData(CoreApp.Dashboard);
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
