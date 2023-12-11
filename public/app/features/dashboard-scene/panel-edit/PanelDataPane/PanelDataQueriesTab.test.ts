import { map, of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, DataSourceInstanceSettings, LoadingState, PanelData } from '@grafana/data';
import { SceneObjectRef, SceneQueryRunner } from '@grafana/scenes';
import { DataQuery, DataSourceJsonData, DataSourceRef } from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { PanelTimeRange, PanelTimeRangeState } from '../../scene/PanelTimeRange';
import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../../utils/utils';

import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import testDashboard from './testfiles/testDashboard.json';

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  const result: PanelData = {
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  };

  return of([]).pipe(
    map(() => {
      result.state = LoadingState.Done;
      result.series = [];

      return result;
    })
  );
});

const ds1Mock: DataSourceApi = {
  name: 'grafana-testdata-datasource',
  type: 'grafana-testdata-datasource',
  uid: 'gdev-testdata',
  getRef: () => {
    return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const ds2Mock: DataSourceApi = {
  name: 'grafana-prometheus-datasource',
  type: 'grafana-prometheus-datasource',
  uid: 'gdev-prometheus',
  getRef: () => {
    return { type: 'grafana-prometheus-datasource', uid: 'gdev-prometheus' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const instance1SettingsMock = {
  id: 1,
  uid: 'gdev-testdata',
  name: 'testDs1',
  type: 'grafana-testdata-datasource',
  meta: {
    id: 'grafana-testdata-datasource',
  },
};

const instance2SettingsMock = {
  id: 1,
  uid: 'gdev-prometheus',
  name: 'testDs2',
  type: 'grafana-prometheus-datasource',
  meta: {
    id: 'grafana-prometheus-datasource',
  },
};

// Mock the store module
jest.mock('app/core/store', () => ({
  exists: jest.fn(),
  getObject: jest.fn(),
  setObject: jest.fn(),
}));

const store = jest.requireMock('app/core/store');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getDataSourceSrv: () => ({
    get: async (ref: DataSourceRef) => {
      if (ref.uid === 'gdev-testdata') {
        return ds1Mock;
      }

      if (ref.uid === 'gdev-prometheus') {
        return ds2Mock;
      }

      return null;
    },
    getInstanceSettings: (ref: DataSourceRef) => {
      if (ref.uid === 'gdev-testdata') {
        return instance1SettingsMock;
      }

      if (ref.uid === 'gdev-prometheus') {
        return instance2SettingsMock;
      }

      return null;
    },
  }),
}));

describe('PanelDataQueriesTab', () => {
  beforeEach(() => {
    store.setObject.mockClear();
  });

  describe('activation', () => {
    it('should load data source', async () => {
      const { tab } = await setupTest();
      expect(tab.state.datasource).toEqual(ds1Mock);
      expect(tab.state.dsSettings).toEqual(instance1SettingsMock);
    });

    it('should store loaded data source in local storage', async () => {
      await setupTest();
      expect(store.setObject).toHaveBeenCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
        dashboardUid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
        datasourceUid: 'gdev-testdata',
      });
    });
  });

  describe('data source change', () => {
    it('should load new data source', async () => {
      const { tab, dataRef } = await setupTest();

      const dataObj = dataRef.resolve();

      dataObj.setState({
        datasource: {
          type: 'grafana-prometheus-datasource',
          uid: 'gdev-prometheus',
        },
      });

      await Promise.resolve();

      expect(store.setObject).toHaveBeenCalledTimes(2);
      expect(store.setObject).toHaveBeenLastCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
        dashboardUid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
        datasourceUid: 'gdev-prometheus',
      });

      expect(tab.state.datasource).toEqual(ds2Mock);
      expect(tab.state.dsSettings).toEqual(instance2SettingsMock);
    });
  });

  describe('query options change', () => {
    describe('time overrides', () => {
      it('should create PanelTimeRange object', async () => {
        const { tab, panelRef } = await setupTest();

        const panel = panelRef.resolve();

        expect(panel.state.$timeRange).toBeUndefined();

        tab.onQueryOptionsChange({
          dataSource: {
            name: 'grafana-testdata',
            type: 'grafana-testdata-datasource',
            default: true,
          },
          queries: [],
          timeRange: {
            from: '1h',
          },
        });

        expect(panel.state.$timeRange).toBeInstanceOf(PanelTimeRange);
      });
      it('should update PanelTimeRange object on time options update', async () => {
        const { tab, panelRef } = await setupTest();

        const panel = panelRef.resolve();

        expect(panel.state.$timeRange).toBeUndefined();

        tab.onQueryOptionsChange({
          dataSource: {
            name: 'grafana-testdata',
            type: 'grafana-testdata-datasource',
            default: true,
          },
          queries: [],
          timeRange: {
            from: '1h',
          },
        });

        expect(panel.state.$timeRange).toBeInstanceOf(PanelTimeRange);
        expect((panel.state.$timeRange?.state as PanelTimeRangeState).timeFrom).toBe('1h');

        tab.onQueryOptionsChange({
          dataSource: {
            name: 'grafana-testdata',
            type: 'grafana-testdata-datasource',
            default: true,
          },
          queries: [],
          timeRange: {
            from: '2h',
          },
        });

        expect((panel.state.$timeRange?.state as PanelTimeRangeState).timeFrom).toBe('2h');
      });

      it('should remove PanelTimeRange object on time options cleared', async () => {
        const { tab, panelRef } = await setupTest();

        const panel = panelRef.resolve();

        expect(panel.state.$timeRange).toBeUndefined();

        tab.onQueryOptionsChange({
          dataSource: {
            name: 'grafana-testdata',
            type: 'grafana-testdata-datasource',
            default: true,
          },
          queries: [],
          timeRange: {
            from: '1h',
          },
        });

        expect(panel.state.$timeRange).toBeInstanceOf(PanelTimeRange);

        tab.onQueryOptionsChange({
          dataSource: {
            name: 'grafana-testdata',
            type: 'grafana-testdata-datasource',
            default: true,
          },
          queries: [],
          timeRange: {
            from: null,
          },
        });

        expect(panel.state.$timeRange).toBeUndefined();
      });
    });

    describe('max data points and interval', () => {
      it('max data points', async () => {
        const { tab, dataRef } = await setupTest();

        const dataObj = dataRef.resolve();

        expect(dataObj.state.maxDataPoints).toBeUndefined();

        tab.onQueryOptionsChange({
          dataSource: {
            name: 'grafana-testdata',
            type: 'grafana-testdata-datasource',
            default: true,
          },
          queries: [],
          maxDataPoints: 100,
        });

        expect(dataObj.state.maxDataPoints).toBe(100);
      });

      it('max data points', async () => {
        const { tab, dataRef } = await setupTest();

        const dataObj = dataRef.resolve();

        expect(dataObj.state.maxDataPoints).toBeUndefined();

        tab.onQueryOptionsChange({
          dataSource: {
            name: 'grafana-testdata',
            type: 'grafana-testdata-datasource',
            default: true,
          },
          queries: [],
          minInterval: '1s',
        });

        expect(dataObj.state.minInterval).toBe('1s');
      });
    });
  });
});

const setupTest = async () => {
  const scene = transformSaveModelToScene({ dashboard: testDashboard as any, meta: {} });

  // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
  // @ts-expect-error
  getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

  const panel1 = findVizPanelByKey(scene, 'panel-1')!;
  const panelRef = new SceneObjectRef(panel1);
  const dataRef = new SceneObjectRef(panel1!.state.$data! as SceneQueryRunner);

  const tab = new PanelDataQueriesTab({
    panelRef,
    dataRef,
  });

  tab.activate();

  await Promise.resolve();

  return {
    tab,
    panelRef,
    dataRef,
  };
};
