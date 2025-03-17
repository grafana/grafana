import { map, of } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceRef,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataTransformer, SceneFlexLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY, DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardDatasourceBehaviour } from './DashboardDatasourceBehaviour';
import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

const grafanaDs = {
  id: 1,
  uid: '-- Grafana --',
  name: 'grafana',
  type: 'grafana',
  meta: {
    id: 'grafana',
  },
  getRef: () => {
    return { type: 'grafana', uid: '-- Grafana --' };
  },
};

const dashboardDs: DataSourceApi = {
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

const mixedDs: DataSourceApi = {
  meta: {
    id: 'mixed',
  },
  name: MIXED_DATASOURCE_NAME,
  type: MIXED_DATASOURCE_NAME,
  uid: MIXED_DATASOURCE_NAME,
  getRef: () => {
    return { type: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  const result: PanelData = {
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
    request,
  };

  return of([]).pipe(
    map(() => {
      result.state = LoadingState.Done;
      result.series = [];

      return result;
    })
  );
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getDataSourceSrv: () => {
    return {
      get: async (ref: DataSourceRef) => {
        if (ref.uid === 'grafana') {
          return grafanaDs;
        }

        if (ref.uid === SHARED_DASHBOARD_QUERY) {
          return dashboardDs;
        }

        if (ref.uid === MIXED_DATASOURCE_NAME) {
          return mixedDs;
        }

        return null;
      },
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
}));

describe('DashboardDatasourceBehaviour', () => {
  describe('Given scene with a dashboard DS panel and a source panel', () => {
    let scene: DashboardScene, sourcePanel: VizPanel, dashboardDSPanel: VizPanel, sceneDeactivate: () => void;

    beforeEach(async () => {
      ({ scene, sourcePanel, dashboardDSPanel, sceneDeactivate } = await buildTestScene());
    });

    it('Should re-run query of dashboardDS panel when source query re-runs', async () => {
      // spy on runQueries that will be called by the behaviour
      const spy = jest.spyOn(dashboardDSPanel.state.$data!.state.$data as SceneQueryRunner, 'runQueries');

      // deactivate scene to mimic going into panel edit
      sceneDeactivate();
      // run source panel queries and update request ID
      (sourcePanel.state.$data!.state.$data as SceneQueryRunner).runQueries();

      await new Promise((r) => setTimeout(r, 1));

      // activate scene to mimic coming back from panel edit
      activateFullSceneTree(scene);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Should not run query of dashboardDS panel when source panel queries do not change', async () => {
      // spy on runQueries
      const spy = jest.spyOn(dashboardDSPanel.state.$data!.state.$data as SceneQueryRunner, 'runQueries');

      // deactivate scene to mimic going into panel edit
      sceneDeactivate();

      await new Promise((r) => setTimeout(r, 1));

      // activate scene to mimic coming back from panel edit
      activateFullSceneTree(scene);

      expect(spy).not.toHaveBeenCalled();
    });

    it('Should not re-run queries in behaviour when adding a dashboardDS panel to the scene', async () => {
      const sourcePanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-1',
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      });

      const behaviour = new DashboardDatasourceBehaviour({});

      const dashboardDSPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneQueryRunner({
          datasource: { uid: SHARED_DASHBOARD_QUERY },
          queries: [{ refId: 'A', panelId: 1 }],
          $behaviors: [behaviour],
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel]),
      });

      activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      const spy = jest.spyOn(dashboardDSPanel.state.$data as SceneQueryRunner, 'runQueries');

      //const layout = scene.state.body as DefaultGridLayoutManager;

      // we add the new panel, it should run it's query as usual
      scene.addPanel(dashboardDSPanel);

      dashboardDSPanel.activate();

      expect(spy).toHaveBeenCalledTimes(1);
      // since there is no previous request ID on dashboard load, the behaviour should not re-run queries
      expect(behaviour['prevRequestId']).toBeUndefined();
    });

    it('Should not re-run queries in behaviour on scene load', async () => {
      const sourcePanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-1',
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      });

      const behaviour = new DashboardDatasourceBehaviour({});

      const dashboardDSPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneQueryRunner({
          datasource: { uid: SHARED_DASHBOARD_QUERY },
          queries: [{ refId: 'A', panelId: 1 }],
          $behaviors: [behaviour],
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
      });

      const spy = jest.spyOn(dashboardDSPanel.state.$data as SceneQueryRunner, 'runQueries');

      activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      expect(spy).toHaveBeenCalledTimes(1);
      // since there is no previous request ID on dashboard load, the behaviour should not re-run queries
      expect(behaviour['prevRequestId']).toBeUndefined();
    });

    it('Should exit behaviour early if not in a dashboard scene', async () => {
      // spy on runQueries
      const spy = jest.spyOn(dashboardDSPanel.state.$data!.state.$data as SceneQueryRunner, 'runQueries');

      const scene = new SceneFlexLayout({
        $data: dashboardDSPanel.state.$data?.clone(),
        children: [],
      });

      scene.activate();

      expect(spy).not.toHaveBeenCalled();
    });

    it('Should not re-run queries if dashboard DS panel references an invalid source panel', async () => {
      const sourcePanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-1',
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      });

      // query references inexistent panel
      const dashboardDSPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneQueryRunner({
          datasource: { uid: SHARED_DASHBOARD_QUERY },
          queries: [{ refId: 'A', panelId: 10 }],
          $behaviors: [new DashboardDatasourceBehaviour({})],
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
      });

      const sceneDeactivate = activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      // spy on runQueries
      const spy = jest.spyOn(dashboardDSPanel.state.$data as SceneQueryRunner, 'runQueries');

      // deactivate scene to mimic going into panel edit
      sceneDeactivate();

      await new Promise((r) => setTimeout(r, 1));

      // activate scene to mimic coming back from panel edit
      activateFullSceneTree(scene);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Given scene with no DashboardDS panel', () => {
    it('Should not re-run queries and exit early in behaviour', async () => {
      const sourcePanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-1',
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      });

      const anotherPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, anotherPanel]),
      });

      const sceneDeactivate = activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      // spy on runQueries
      const spy = jest.spyOn(anotherPanel.state.$data as SceneQueryRunner, 'runQueries');

      // deactivate scene to mimic going into panel edit
      sceneDeactivate();
      // run source panel queries and update request ID
      (sourcePanel.state.$data as SceneQueryRunner).runQueries();

      await new Promise((r) => setTimeout(r, 1));

      // activate scene to mimic coming back from panel edit
      activateFullSceneTree(scene);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Given an invalid state', () => {
    it('Should throw an error if behaviour is not attached to a SceneQueryRunner', () => {
      const behaviour = new DashboardDatasourceBehaviour({});

      expect(() => behaviour.activate()).toThrow('DashboardDatasourceBehaviour must be attached to a SceneQueryRunner');
    });

    it('Should throw an error if source panel does not have a SceneQueryRunner', async () => {
      const sourcePanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-1',
        $data: undefined,
      });

      const dashboardDSPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneQueryRunner({
          datasource: { uid: SHARED_DASHBOARD_QUERY },
          queries: [{ refId: 'A', panelId: 1 }],
          $behaviors: [new DashboardDatasourceBehaviour({})],
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
      });

      try {
        activateFullSceneTree(scene);
      } catch (e) {
        expect(e).toEqual(new Error('Could not find SceneQueryRunner for panel'));
      }
    });
  });

  describe('Library panels', () => {
    it('should re-run queries when library panel re-runs query', async () => {
      const libPanelBehavior = new LibraryPanelBehavior({
        isLoaded: false,
        uid: 'fdcvggvfy2qdca',
        name: 'My Library Panel',
        _loadedPanel: undefined,
      });

      const sourcePanel = new VizPanel({
        key: 'panel-1',
        title: 'Panel A',
        pluginId: 'table',
        $behaviors: [libPanelBehavior],
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      });

      // query references inexistent panel
      const dashboardDSPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneQueryRunner({
          datasource: { uid: SHARED_DASHBOARD_QUERY },
          queries: [{ refId: 'A', panelId: 1 }],
          $behaviors: [new DashboardDatasourceBehaviour({})],
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
      });

      const sceneDeactivate = activateFullSceneTree(scene);

      // spy on runQueries
      const spy = jest.spyOn(dashboardDSPanel.state.$data as SceneQueryRunner, 'runQueries');

      // deactivate scene to mimic going into panel edit
      sceneDeactivate();

      // run source panel queries and update request ID
      (sourcePanel.state.$data as SceneQueryRunner).runQueries();

      // // activate scene to mimic coming back from panel edit
      activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should wait for library panel to load before running queries', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const libPanelBehavior = new LibraryPanelBehavior({
        isLoaded: false,
        uid: 'fdcvggvfy2qdca',
        name: 'My Library Panel',
        _loadedPanel: undefined,
      });

      const sourcePanel = new VizPanel({
        key: 'panel-1',
        title: 'Panel A',
        pluginId: 'table',
        $behaviors: [libPanelBehavior],
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      });

      // query references inexistent panel
      const dashboardDSPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneQueryRunner({
          datasource: { uid: SHARED_DASHBOARD_QUERY },
          queries: [{ refId: 'A', panelId: 1 }],
          $behaviors: [new DashboardDatasourceBehaviour({})],
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
      });

      activateFullSceneTree(scene);

      // spy on runQueries
      const spyRunQueries = jest.spyOn(dashboardDSPanel.state.$data as SceneQueryRunner, 'runQueries');

      await new Promise((r) => setTimeout(r, 1));

      expect(spyRunQueries).not.toHaveBeenCalled();

      // Simulate library panel being loaded
      libPanelBehavior.setState({
        isLoaded: true,
        uid: 'fdcvggvfy2qdca',
        name: 'My Library Panel',
        _loadedPanel: undefined,
      });

      expect(spyRunQueries).toHaveBeenCalledTimes(1);
    });
  });

  describe('DashboardDS within MixedDS', () => {
    it('Should re-run query of MixedDS panel that contains a dashboardDS when source query re-runs', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const sourcePanel = new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-1',
        $data: new SceneDataTransformer({
          transformations: [],
          $data: new SceneQueryRunner({
            datasource: { uid: 'grafana' },
            queries: [{ refId: 'A', queryType: 'randomWalk' }],
          }),
        }),
      });

      const dashboardDSPanel = new VizPanel({
        title: 'Panel B',
        pluginId: 'table',
        key: 'panel-2',
        $data: new SceneDataTransformer({
          transformations: [],
          $data: new SceneQueryRunner({
            datasource: { uid: MIXED_DATASOURCE_NAME },
            queries: [
              {
                datasource: { uid: SHARED_DASHBOARD_QUERY },
                refId: 'B',
                panelId: 1,
              },
            ],
            $behaviors: [new DashboardDatasourceBehaviour({})],
          }),
        }),
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        meta: {
          canEdit: true,
        },
        body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
      });

      const sceneDeactivate = activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      // spy on runQueries that will be called by the behaviour
      const spy = jest
        .spyOn(dashboardDSPanel.state.$data!.state.$data as SceneQueryRunner, 'runQueries')
        .mockImplementation();

      // deactivate scene to mimic going into panel edit
      sceneDeactivate();
      // run source panel queries and update request ID
      (sourcePanel.state.$data!.state.$data as SceneQueryRunner).runQueries();

      await new Promise((r) => setTimeout(r, 1));

      // activate scene to mimic coming back from panel edit
      activateFullSceneTree(scene);

      expect(spy).toHaveBeenCalled();
    });
  });

  it('Should re-run query after transformations reprocess', async () => {
    const sourcePanel = new VizPanel({
      title: 'Panel A',
      pluginId: 'table',
      key: 'panel-1',
      $data: new SceneDataTransformer({
        transformations: [{ id: 'transformA', options: {} }],
        $data: new SceneQueryRunner({
          datasource: { uid: 'grafana' },
          queries: [{ refId: 'A', queryType: 'randomWalk' }],
        }),
      }),
    });

    const dashboardDSPanel = new VizPanel({
      title: 'Panel B',
      pluginId: 'table',
      key: 'panel-2',
      $data: new SceneDataTransformer({
        transformations: [],
        $data: new SceneQueryRunner({
          datasource: { uid: MIXED_DATASOURCE_NAME },
          queries: [
            {
              datasource: { uid: SHARED_DASHBOARD_QUERY },
              refId: 'B',
              panelId: 1,
            },
          ],
          $behaviors: [new DashboardDatasourceBehaviour({})],
        }),
      }),
    });

    const scene = new DashboardScene({
      title: 'hello',
      uid: 'dash-1',
      meta: {
        canEdit: true,
      },
      body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
    });

    activateFullSceneTree(scene);

    await new Promise((r) => setTimeout(r, 1));

    // spy on runQueries that will be called by the behaviour
    const spy = jest
      .spyOn(dashboardDSPanel.state.$data!.state.$data as SceneQueryRunner, 'runQueries')
      .mockImplementation();

    // transformations are reprocessed (e.g. variable change) and data is updated so
    // we re-run the queries in the dashboardDS panel because we lose the subscription
    // in mixed DS scenario
    (sourcePanel.state.$data as SceneDataTransformer).setState({
      data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
    });

    expect(spy).toHaveBeenCalled();
  });
});

async function buildTestScene() {
  const sourcePanel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-1',
    $data: new SceneDataTransformer({
      transformations: [],
      $data: new SceneQueryRunner({
        datasource: { uid: 'grafana' },
        queries: [{ refId: 'A', queryType: 'randomWalk' }],
      }),
    }),
  });

  const dashboardDSPanel = new VizPanel({
    title: 'Panel B',
    pluginId: 'table',
    key: 'panel-2',
    $data: new SceneDataTransformer({
      transformations: [],
      $data: new SceneQueryRunner({
        datasource: { uid: SHARED_DASHBOARD_QUERY },
        queries: [{ refId: 'A', panelId: 1 }],
        $behaviors: [new DashboardDatasourceBehaviour({})],
      }),
    }),
  });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    body: DefaultGridLayoutManager.fromVizPanels([sourcePanel, dashboardDSPanel]),
  });

  const sceneDeactivate = activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  return { scene, sourcePanel, dashboardDSPanel, sceneDeactivate };
}
