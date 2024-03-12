import { map, of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, DataSourceInstanceSettings, LoadingState, PanelData } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneGridItem, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { DataQuery, DataSourceJsonData, DataSourceRef } from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { InspectTab } from 'app/features/inspector/types';
import * as libAPI from 'app/features/library-panels/state/api';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/types';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { PanelTimeRange, PanelTimeRangeState } from '../scene/PanelTimeRange';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../utils/utils';

import { buildPanelEditScene } from './PanelEditor';
import { VizPanelManager } from './VizPanelManager';
import { panelWithQueriesOnly, panelWithTransformations, testDashboard } from './testfiles/testDashboard';

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
  meta: {
    id: 'grafana-testdata-datasource',
  },
  name: 'grafana-testdata-datasource',
  type: 'grafana-testdata-datasource',
  uid: 'gdev-testdata',
  getRef: () => {
    return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const ds2Mock: DataSourceApi = {
  meta: {
    id: 'grafana-prometheus-datasource',
  },
  name: 'grafana-prometheus-datasource',
  type: 'grafana-prometheus-datasource',
  uid: 'gdev-prometheus',
  getRef: () => {
    return { type: 'grafana-prometheus-datasource', uid: 'gdev-prometheus' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const ds3Mock: DataSourceApi = {
  meta: {
    id: DASHBOARD_DATASOURCE_PLUGIN_ID,
  },
  name: SHARED_DASHBOARD_QUERY,
  type: SHARED_DASHBOARD_QUERY,
  uid: SHARED_DASHBOARD_QUERY,
  getRef: () => {
    return { type: SHARED_DASHBOARD_QUERY, uid: SHARED_DASHBOARD_QUERY };
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
  get: jest.fn(),
  getObject: jest.fn((_a, b) => b),
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

      if (ref.uid === SHARED_DASHBOARD_QUERY) {
        return ds3Mock;
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
  locationService: {
    partial: jest.fn(),
  },
}));

describe('VizPanelManager', () => {
  describe('When changing plugin', () => {
    it('Should successfully change from one viz type to another', () => {
      const { vizPanelManager } = setupTest('panel-1');
      expect(vizPanelManager.state.panel.state.pluginId).toBe('timeseries');
      vizPanelManager.changePluginType('table');
      expect(vizPanelManager.state.panel.state.pluginId).toBe('table');
    });

    it('Should clear custom options', () => {
      const overrides = [
        {
          matcher: { id: 'matcherOne' },
          properties: [{ id: 'custom.propertyOne' }, { id: 'custom.propertyTwo' }, { id: 'standardProperty' }],
        },
      ];
      const vizPanel = new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
        options: undefined,
        fieldConfig: {
          defaults: {
            custom: 'Custom',
          },
          overrides,
        },
      });

      const vizPanelManager = VizPanelManager.createFor(vizPanel);

      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toBe('Custom');
      expect(vizPanelManager.state.panel.state.fieldConfig.overrides).toBe(overrides);

      vizPanelManager.changePluginType('timeseries');

      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toStrictEqual({});
      expect(vizPanelManager.state.panel.state.fieldConfig.overrides[0].properties).toHaveLength(1);
      expect(vizPanelManager.state.panel.state.fieldConfig.overrides[0].properties[0].id).toBe('standardProperty');
    });

    it('Should restore cached options/fieldConfig if they exist', () => {
      const vizPanel = new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
        options: {
          customOption: 'A',
        },
        fieldConfig: { defaults: { custom: 'Custom' }, overrides: [] },
      });

      const vizPanelManager = VizPanelManager.createFor(vizPanel);

      vizPanelManager.changePluginType('timeseries');
      //@ts-ignore
      expect(vizPanelManager.state.panel.state.options['customOption']).toBeUndefined();
      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toStrictEqual({});

      vizPanelManager.changePluginType('table');

      //@ts-ignore
      expect(vizPanelManager.state.panel.state.options['customOption']).toBe('A');
      expect(vizPanelManager.state.panel.state.fieldConfig.defaults.custom).toBe('Custom');
    });
  });

  describe('library panels', () => {
    it('saves library panels on commit', () => {
      const panel = new VizPanel({
        key: 'panel-1',
        pluginId: 'text',
      });

      const libraryPanelModel = {
        title: 'title',
        uid: 'uid',
        name: 'libraryPanelName',
        model: vizPanelToPanel(panel),
        type: 'panel',
        version: 1,
      };

      const libraryPanel = new LibraryVizPanel({
        isLoaded: true,
        title: libraryPanelModel.title,
        uid: libraryPanelModel.uid,
        name: libraryPanelModel.name,
        panelKey: panel.state.key!,
        panel: panel,
        _loadedPanel: libraryPanelModel,
      });

      new SceneGridItem({ body: libraryPanel });

      const panelManager = VizPanelManager.createFor(panel);

      const apiCall = jest
        .spyOn(libAPI, 'updateLibraryVizPanel')
        .mockResolvedValue({ type: 'panel', ...libAPI.libraryVizPanelToSaveModel(libraryPanel) });

      panelManager.state.panel.setState({ title: 'new title' });
      panelManager.commitChanges();

      expect(apiCall.mock.calls[0][0].state.panel?.state.title).toBe('new title');
    });
  });

  describe('query options', () => {
    beforeEach(() => {
      store.setObject.mockClear();
    });

    describe('activation', () => {
      it('should load data source', async () => {
        const { vizPanelManager } = setupTest('panel-1');
        vizPanelManager.activate();
        await Promise.resolve();

        expect(vizPanelManager.state.datasource).toEqual(ds1Mock);
        expect(vizPanelManager.state.dsSettings).toEqual(instance1SettingsMock);
      });

      it('should store loaded data source in local storage', async () => {
        const { vizPanelManager } = setupTest('panel-1');
        vizPanelManager.activate();
        await Promise.resolve();

        expect(store.setObject).toHaveBeenCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
          dashboardUid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
          datasourceUid: 'gdev-testdata',
        });
      });
    });

    describe('data source change', () => {
      it('should load new data source', async () => {
        const { vizPanelManager } = setupTest('panel-1');
        vizPanelManager.activate();
        vizPanelManager.state.panel.state.$data?.activate();

        await Promise.resolve();

        await vizPanelManager.changePanelDataSource(
          { type: 'grafana-prometheus-datasource', uid: 'gdev-prometheus' } as DataSourceInstanceSettings,
          []
        );

        expect(store.setObject).toHaveBeenCalledTimes(2);
        expect(store.setObject).toHaveBeenLastCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
          dashboardUid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
          datasourceUid: 'gdev-prometheus',
        });

        expect(vizPanelManager.state.datasource).toEqual(ds2Mock);
        expect(vizPanelManager.state.dsSettings).toEqual(instance2SettingsMock);
      });
    });

    describe('query options change', () => {
      describe('time overrides', () => {
        it('should create PanelTimeRange object', async () => {
          const { vizPanelManager } = setupTest('panel-1');
          vizPanelManager.activate();
          vizPanelManager.state.panel.state.$data?.activate();
          await Promise.resolve();

          const panel = vizPanelManager.state.panel;

          expect(panel.state.$timeRange).toBeUndefined();

          vizPanelManager.changeQueryOptions({
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
          const { vizPanelManager } = setupTest('panel-1');
          vizPanelManager.activate();
          await Promise.resolve();

          const panel = vizPanelManager.state.panel;

          expect(panel.state.$timeRange).toBeUndefined();

          vizPanelManager.changeQueryOptions({
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

          vizPanelManager.changeQueryOptions({
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
          const { vizPanelManager } = setupTest('panel-1');
          vizPanelManager.activate();
          await Promise.resolve();

          const panel = vizPanelManager.state.panel;

          expect(panel.state.$timeRange).toBeUndefined();

          vizPanelManager.changeQueryOptions({
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

          vizPanelManager.changeQueryOptions({
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
          const { vizPanelManager } = setupTest('panel-1');
          vizPanelManager.activate();
          await Promise.resolve();

          const dataObj = vizPanelManager.queryRunner;

          expect(dataObj.state.maxDataPoints).toBeUndefined();

          vizPanelManager.changeQueryOptions({
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
          const { vizPanelManager } = setupTest('panel-1');
          vizPanelManager.activate();
          await Promise.resolve();

          const dataObj = vizPanelManager.queryRunner;

          expect(dataObj.state.maxDataPoints).toBeUndefined();

          vizPanelManager.changeQueryOptions({
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

      describe('query caching', () => {
        it('updates cacheTimeout and queryCachingTTL', async () => {
          const { vizPanelManager } = setupTest('panel-1');
          vizPanelManager.activate();
          await Promise.resolve();

          const dataObj = vizPanelManager.queryRunner;

          vizPanelManager.changeQueryOptions({
            cacheTimeout: '60',
            queryCachingTTL: 200000,
            dataSource: {
              name: 'grafana-testdata',
              type: 'grafana-testdata-datasource',
              default: true,
            },
            queries: [],
          });

          expect(dataObj.state.cacheTimeout).toBe('60');
          expect(dataObj.state.queryCachingTTL).toBe(200000);
        });
      });
    });

    describe('query inspection', () => {
      it('allows query inspection from the tab', async () => {
        const { vizPanelManager } = setupTest('panel-1');
        vizPanelManager.inspectPanel();

        expect(locationService.partial).toHaveBeenCalledWith({ inspect: 1, inspectTab: InspectTab.Query });
      });
    });

    describe('data source change', () => {
      it('changing from one plugin to another', async () => {
        const { vizPanelManager } = setupTest('panel-1');
        vizPanelManager.activate();
        await Promise.resolve();

        expect(vizPanelManager.queryRunner.state.datasource).toEqual({
          uid: 'gdev-testdata',
          type: 'grafana-testdata-datasource',
        });

        await vizPanelManager.changePanelDataSource({
          name: 'grafana-prometheus',
          type: 'grafana-prometheus-datasource',
          uid: 'gdev-prometheus',
          meta: {
            name: 'Prometheus',
            module: 'prometheus',
            id: 'grafana-prometheus-datasource',
          },
        } as DataSourceInstanceSettings);

        expect(vizPanelManager.queryRunner.state.datasource).toEqual({
          uid: 'gdev-prometheus',
          type: 'grafana-prometheus-datasource',
        });
      });

      it('changing from a plugin to a dashboard data source', async () => {
        const { vizPanelManager } = setupTest('panel-1');
        vizPanelManager.activate();
        await Promise.resolve();

        expect(vizPanelManager.queryRunner.state.datasource).toEqual({
          uid: 'gdev-testdata',
          type: 'grafana-testdata-datasource',
        });

        await vizPanelManager.changePanelDataSource({
          name: SHARED_DASHBOARD_QUERY,
          type: 'datasource',
          uid: SHARED_DASHBOARD_QUERY,
          meta: {
            name: 'Prometheus',
            module: 'prometheus',
            id: DASHBOARD_DATASOURCE_PLUGIN_ID,
          },
        } as DataSourceInstanceSettings);

        expect(vizPanelManager.queryRunner.state.datasource).toEqual({
          uid: SHARED_DASHBOARD_QUERY,
          type: 'datasource',
        });
      });

      it('changing from dashboard data source to a plugin', async () => {
        const { vizPanelManager } = setupTest('panel-3');
        vizPanelManager.activate();
        await Promise.resolve();

        expect(vizPanelManager.queryRunner.state.datasource).toEqual({
          uid: SHARED_DASHBOARD_QUERY,
          type: 'datasource',
        });

        await vizPanelManager.changePanelDataSource({
          name: 'grafana-prometheus',
          type: 'grafana-prometheus-datasource',
          uid: 'gdev-prometheus',
          meta: {
            name: 'Prometheus',
            module: 'prometheus',
            id: 'grafana-prometheus-datasource',
          },
        } as DataSourceInstanceSettings);

        expect(vizPanelManager.queryRunner.state.datasource).toEqual({
          uid: 'gdev-prometheus',
          type: 'grafana-prometheus-datasource',
        });
      });
    });
  });

  describe('change transformations', () => {
    it('should update and reprocess transformations', () => {
      const { scene, panel } = setupTest('panel-3');
      scene.setState({ editPanel: buildPanelEditScene(panel) });

      const vizPanelManager = scene.state.editPanel!.state.vizManager;
      vizPanelManager.activate();
      vizPanelManager.state.panel.state.$data?.activate();

      const reprocessMock = jest.fn();
      vizPanelManager.dataTransformer.reprocessTransformations = reprocessMock;
      vizPanelManager.changeTransformations([{ id: 'calculateField', options: {} }]);

      expect(reprocessMock).toHaveBeenCalledTimes(1);
      expect(vizPanelManager.dataTransformer.state.transformations).toEqual([{ id: 'calculateField', options: {} }]);
    });
  });

  describe('change queries', () => {
    describe('plugin queries', () => {
      it('should update queries', () => {
        const { vizPanelManager } = setupTest('panel-1');

        vizPanelManager.activate();
        vizPanelManager.state.panel.state.$data?.activate();

        vizPanelManager.changeQueries([
          {
            datasource: {
              type: 'grafana-testdata-datasource',
              uid: 'gdev-testdata',
            },
            refId: 'A',
            scenarioId: 'random_walk',
            seriesCount: 5,
          },
        ]);

        expect(vizPanelManager.queryRunner.state.queries).toEqual([
          {
            datasource: {
              type: 'grafana-testdata-datasource',
              uid: 'gdev-testdata',
            },
            refId: 'A',
            scenarioId: 'random_walk',
            seriesCount: 5,
          },
        ]);
      });
    });

    describe('dashboard queries', () => {
      it('should update queries', () => {
        const { scene, panel } = setupTest('panel-3');
        scene.setState({ editPanel: buildPanelEditScene(panel) });

        const vizPanelManager = scene.state.editPanel!.state.vizManager;
        vizPanelManager.activate();
        vizPanelManager.state.panel.state.$data?.activate();

        // Changing dashboard query to a panel with transformations
        vizPanelManager.changeQueries([
          {
            refId: 'A',
            datasource: {
              type: DASHBOARD_DATASOURCE_PLUGIN_ID,
            },
            panelId: panelWithTransformations.id,
          },
        ]);

        expect(vizPanelManager.queryRunner.state.queries[0].panelId).toEqual(panelWithTransformations.id);

        // Changing dashboard query to a panel with queries only
        vizPanelManager.changeQueries([
          {
            refId: 'A',
            datasource: {
              type: DASHBOARD_DATASOURCE_PLUGIN_ID,
            },
            panelId: panelWithQueriesOnly.id,
          },
        ]);

        expect(vizPanelManager.queryRunner.state.queries[0].panelId).toBe(panelWithQueriesOnly.id);
      });
    });
  });
});

const setupTest = (panelId: string) => {
  const scene = transformSaveModelToScene({ dashboard: testDashboard, meta: {} });
  const panel = findVizPanelByKey(scene, panelId)!;

  const vizPanelManager = VizPanelManager.createFor(panel);
  // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
  // @ts-expect-error
  getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

  return { vizPanelManager, scene, panel };
};
