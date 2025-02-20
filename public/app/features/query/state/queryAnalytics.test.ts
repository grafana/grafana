import {
  CoreApp,
  DataFrame,
  DataQueryError,
  getDefaultTimeRange,
  DataSourceApi,
  dateTime,
  LoadingState,
  PanelData,
  DataQueryRequest,
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

function getTestData(
  overrides: Partial<DataQueryRequest> = {},
  series?: DataFrame[],
  errors?: DataQueryError[]
): PanelData {
  const now = dateTime();
  return {
    request: {
      app: CoreApp.Dashboard,
      startTime: now.unix(),
      endTime: now.add(1, 's').unix(),
      interval: '1s',
      intervalMs: 1000,
      range: getDefaultTimeRange(),
      requestId: '1',
      scopedVars: {},
      targets: [],
      timezone: 'utc',
      panelPluginId: 'timeseries',
      ...overrides,
    },
    series: series || [],
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
    errors,
  };
}

describe('emitDataRequestEvent', () => {
  describe('From a dashboard panel', () => {
    it('Should report meta analytics', () => {
      const data = getTestData({
        panelId: 2,
        panelName: 'Panel Name2',
      });
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: MetaAnalyticsEventName.DataRequest,
          datasourceName: datasource.name,
          datasourceUid: datasource.uid,
          datasourceType: datasource.type,
          source: CoreApp.Dashboard,
          panelId: 2,
          panelName: 'Panel Name2',
          dashboardUid: 'test', // from dashboard srv
          dataSize: 0,
          duration: 1,
          totalQueries: 0,
          cachedQueries: 0,
          panelPluginId: 'timeseries',
        })
      );
    });

    it('Should report meta analytics with counts for cached and total queries', () => {
      const data = getTestData(
        {
          panelId: 2,
          panelName: 'Panel Name2',
        },
        partiallyCachedSeries
      );
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: MetaAnalyticsEventName.DataRequest,
          datasourceName: datasource.name,
          datasourceUid: datasource.uid,
          datasourceType: datasource.type,
          source: CoreApp.Dashboard,
          panelId: 2,
          panelName: 'Panel Name2',
          dashboardUid: 'test',
          dataSize: 2,
          duration: 1,
          totalQueries: 2,
          cachedQueries: 1,
          panelPluginId: 'timeseries',
        })
      );
    });

    it('Should report meta analytics with counts for cached and total queries when same refId spread across multiple DataFrames', () => {
      const data = getTestData(
        {
          panelId: 2,
          panelName: 'Panel Name2',
        },
        multipleDataframesWithSameRefId
      );
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: MetaAnalyticsEventName.DataRequest,
          datasourceName: datasource.name,
          datasourceUid: datasource.uid,
          datasourceType: datasource.type,
          source: CoreApp.Dashboard,
          panelId: 2,
          panelName: 'Panel Name2',
          dashboardUid: 'test', // from dashboard srv
          dataSize: 2,
          duration: 1,
          totalQueries: 1,
          cachedQueries: 1,
          panelPluginId: 'timeseries',
        })
      );
    });

    it('Should not report meta analytics twice if the request receives multiple responses', () => {
      const data = getTestData();
      const fn = emitDataRequestEvent(datasource);
      fn(data);
      fn(data);
      expect(reportMetaAnalytics).toBeCalledTimes(1);
    });

    it('Should not report meta analytics in edit mode', () => {
      mockGetUrlSearchParams.mockImplementationOnce(() => {
        return { editPanel: 2 };
      });
      const data = getTestData();
      emitDataRequestEvent(datasource)(data);
      expect(reportMetaAnalytics).not.toBeCalled();
    });

    it('Should not report errors when there are none', () => {
      const data = getTestData({
        panelId: 2,
      });
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(expect.not.objectContaining({ error: expect.any(String) }));
    });

    it('Should report errors if they exist', () => {
      const data = getTestData(
        {
          panelId: 2,
        },
        undefined,
        [{ message: 'message A' }, { message: 'message B' }]
      );
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(expect.objectContaining({ error: 'message A, message B' }));
    });
  });

  // Previously we filtered out Explore and Correlations events due to too many errors being generated while a user is building a query
  // This tests that we send an event for both queries but do not record errors
  describe('From Explore', () => {
    const data = getTestData(
      {
        app: CoreApp.Explore,
      },
      undefined,
      [{ message: 'test error' }]
    );

    it('Should report meta analytics', () => {
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: MetaAnalyticsEventName.DataRequest,
          source: CoreApp.Explore,
          datasourceName: 'test',
          datasourceUid: 'test',
          dataSize: 0,
          duration: 1,
          totalQueries: 0,
          panelPluginId: 'timeseries',
        })
      );
    });

    it('Should not report errors', () => {
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(expect.not.objectContaining({ error: 'test error' }));
    });
  });

  // Previously we filtered out Explore and Correlations events due to too many errors being generated while a user is building a query
  // This tests that we send an event for both queries but do not record errors
  describe('From Correlations', () => {
    const data = getTestData(
      {
        app: CoreApp.Correlations,
      },
      undefined,
      [{ message: 'some error' }]
    );

    it('Should report meta analytics', () => {
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: MetaAnalyticsEventName.DataRequest,
          source: CoreApp.Correlations,
          datasourceName: 'test',
          datasourceUid: 'test',
          dataSize: 0,
          duration: 1,
          totalQueries: 0,
          panelPluginId: 'timeseries',
        })
      );
    });

    it('Should not report errors', () => {
      emitDataRequestEvent(datasource)(data);

      expect(reportMetaAnalytics).toBeCalledTimes(1);
      expect(reportMetaAnalytics).toHaveBeenCalledWith(expect.not.objectContaining({ error: 'test error' }));
    });
  });
});
