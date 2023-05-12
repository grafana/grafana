import {
  CoreApp,
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataSourceApi,
  dateTime,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { MetaAnalyticsEventName, reportMetaAnalytics } from '@grafana/runtime';

import { createDashboardModelFixture } from '../../dashboard/state/__fixtures__/dashboardFixtures';

import { emitDataRequestEvent } from './queryAnalytics';

beforeEach(() => {
  jest.clearAllMocks();
});

const datasource = {
  name: 'test',
  id: 1,
  uid: 'test',
} as DataSourceApi;

const dashboardModel = createDashboardModelFixture(
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

function getTestDataForExplore(requestApp: string, series: DataFrame[] = []): PanelData {
  const now = dateTime();
  const error: DataQueryError = { message: 'test error' };

  return {
    request: {
      app: requestApp,
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
    error: error,
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
        datasourceUid: datasource.uid,
        datasourceType: datasource.type,
        source: 'dashboard',
        panelId: 2,
        dashboardUid: 'test', // from dashboard srv
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
        datasourceUid: datasource.uid,
        datasourceType: datasource.type,
        source: 'dashboard',
        panelId: 2,
        dashboardUid: 'test',
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
        datasourceUid: datasource.uid,
        datasourceType: datasource.type,
        source: 'dashboard',
        panelId: 2,
        dashboardUid: 'test', // from dashboard srv
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

// Previously we filtered out Explore events due to too many errors being generated while a user is building a query
// This tests that we send an event for Explore queries but do not record errors
describe('emitDataRequestEvent - from Explore', () => {
  it('Should report meta analytics', () => {
    const data = getTestDataForExplore(CoreApp.Explore);
    emitDataRequestEvent(datasource)(data);

    expect(reportMetaAnalytics).toBeCalledTimes(1);
    expect(reportMetaAnalytics).toBeCalledWith(
      expect.objectContaining({
        eventName: MetaAnalyticsEventName.DataRequest,
        source: 'explore',
        datasourceName: 'test',
        datasourceUid: 'test',
        dataSize: 0,
        duration: 1,
        totalQueries: 0,
      })
    );
  });

  describe('emitDataRequestEvent - from Explore', () => {
    it('Should not report errors', () => {
      const data = getTestDataForExplore(CoreApp.Explore);
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toBeCalledWith(expect.not.objectContaining({ error: 'test error' }));
    });
  });
});
