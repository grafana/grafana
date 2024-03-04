import { map, of } from 'rxjs';

import { AnnotationQuery, DataQueryRequest, DataSourceApi, LoadingState, PanelData } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataLayers, SceneGridItem, SceneGridLayout, SceneTimeRange, VizPanel, dataLayers } from '@grafana/scenes';

import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardScene } from '../scene/DashboardScene';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { activateFullSceneTree } from '../utils/test-utils';

import { AnnotationsEditView, MoveDirection } from './AnnotationsEditView';
import { newAnnotationName } from './annotations/AnnotationSettingsEdit';

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

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  config: {
    publicDashboardAccessToken: 'ac123',
  },
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('AnnotationsEditView', () => {
  describe('Dashboard annotations state', () => {
    let annotationsView: AnnotationsEditView;
    let dashboardScene: DashboardScene;

    beforeEach(async () => {
      const result = await buildTestScene();
      annotationsView = result.annotationsView;
      dashboardScene = result.dashboard;
    });

    it('should return the correct urlKey', () => {
      expect(annotationsView.getUrlKey()).toBe('annotations');
    });

    it('should return the annotations length', () => {
      expect(annotationsView.getAnnotationsLength()).toBe(1);
    });

    it('should return 0 if no annotations', () => {
      dashboardScene.setState({
        $data: new SceneDataLayers({ layers: [] }),
      });

      expect(annotationsView.getAnnotationsLength()).toBe(0);
    });

    it('should add a new annotation and group it with the other annotations', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      expect(dataLayers?.state.layers.length).toBe(2);

      annotationsView.onNew();

      expect(dataLayers?.state.layers.length).toBe(3);
      expect(dataLayers?.state.layers[1].state.name).toBe(newAnnotationName);
      expect(dataLayers?.state.layers[1].isActive).toBe(true);
    });

    it('should move an annotation up one position', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      annotationsView.onNew();

      expect(dataLayers?.state.layers.length).toBe(3);
      expect(dataLayers?.state.layers[0].state.name).toBe('test');

      annotationsView.onMove(1, MoveDirection.UP);

      expect(dataLayers?.state.layers.length).toBe(3);
      expect(dataLayers?.state.layers[0].state.name).toBe(newAnnotationName);
    });

    it('should move an annotation down one position', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      annotationsView.onNew();

      expect(dataLayers?.state.layers.length).toBe(3);
      expect(dataLayers?.state.layers[0].state.name).toBe('test');

      annotationsView.onMove(0, MoveDirection.DOWN);

      expect(dataLayers?.state.layers.length).toBe(3);
      expect(dataLayers?.state.layers[0].state.name).toBe(newAnnotationName);
    });

    it('should delete annotation at index', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      expect(dataLayers?.state.layers.length).toBe(2);

      annotationsView.onDelete(0);

      expect(dataLayers?.state.layers.length).toBe(1);
      expect(dataLayers?.state.layers[0].state.name).toBe('Alert States');
    });

    it('should update an annotation at index', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      expect(dataLayers?.state.layers[0].state.name).toBe('test');

      const annotation: AnnotationQuery = {
        ...(dataLayers?.state.layers[0] as dataLayers.AnnotationsDataLayer).state.query,
      };

      annotation.name = 'new name';
      annotation.hide = true;
      annotation.enable = false;
      annotation.iconColor = 'blue';
      annotationsView.onUpdate(annotation, 0);

      expect(dataLayers?.state.layers.length).toBe(2);
      expect(dataLayers?.state.layers[0].state.name).toBe('new name');
      expect((dataLayers?.state.layers[0] as dataLayers.AnnotationsDataLayer).state.query.name).toBe('new name');
      expect((dataLayers?.state.layers[0] as dataLayers.AnnotationsDataLayer).state.query.hide).toBe(true);
      expect((dataLayers?.state.layers[0] as dataLayers.AnnotationsDataLayer).state.query.enable).toBe(false);
      expect((dataLayers?.state.layers[0] as dataLayers.AnnotationsDataLayer).state.query.iconColor).toBe('blue');
    });
  });
});

async function buildTestScene() {
  const annotationsView = new AnnotationsEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
    meta: {
      canEdit: true,
    },
    $data: new SceneDataLayers({
      layers: [
        new DashboardAnnotationsDataLayer({
          key: `annotations-test`,
          query: {
            enable: true,
            iconColor: 'red',
            name: 'test',
            datasource: {
              type: 'grafana',
              uid: '-- Grafana --',
            },
          },
          name: 'test',
          isEnabled: true,
          isHidden: false,
        }),
        new AlertStatesDataLayer({
          key: 'alert-states',
          name: 'Alert States',
        }),
      ],
    }),
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
          }),
        }),
      ],
    }),
    editview: annotationsView,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  annotationsView.activate();

  return { dashboard, annotationsView };
}
