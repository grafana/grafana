import { map, of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, LoadingState, PanelData } from '@grafana/data';
import { SceneDataLayers, SceneGridItem, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';

import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { AnnotationsEditView } from './AnnotationsEditView';

const getDataSourceSrvSpy = jest.fn();
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
    getDataSourceSrvSpy();
  },
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  config: {
    publicDashboardAccessToken: 'ac123',
  },
}));

describe('AnnotationsEditView', () => {
  describe('Dashboard annotations state', () => {
    let annotationsView: AnnotationsEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      annotationsView = result.annotationsView;
    });

    it('should return the correct urlKey', () => {
      expect(annotationsView.getUrlKey()).toBe('annotations');
    });

    it('should return the scene data layers', () => {
      const dataLayers = annotationsView.getSceneDataLayers();

      expect(dataLayers).toBeInstanceOf(SceneDataLayers);
      expect(dataLayers?.state.layers.length).toBe(2);
    });

    it('should return the annotations length', () => {
      expect(annotationsView.getAnnotationsLength()).toBe(1);
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
          body: undefined,
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
