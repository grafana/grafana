import { cleanup } from '@testing-library/react';
import { map, of } from 'rxjs';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { render, userEvent, waitFor } from 'test/test-utils';

import {
  type AnnotationQuery,
  type DataQueryRequest,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  getDataSourceUID,
  LoadingState,
  type PanelData,
} from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneTimeRange, type dataLayers } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { testWithFlags } from '@grafana/test-utils/unstable';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet, NEW_ANNOTATION_NAME } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { activateFullSceneTree } from '../utils/test-utils';

import { AnnotationsEditView } from './AnnotationsEditView';
import { AnnotationsEditViewRenderer } from './AnnotationsEditViewRenderer';
import { MoveDirection } from './annotations/MoveDirection';

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

const noAnnotationsDsInstanceSettings = {
  name: 'noAnnotationsDs',
  uid: 'noAnnotationsDs',
  meta: {
    annotations: false,
  } as DataSourcePluginMeta,
  readOnly: false,
  type: 'noAnnotations',
} as DataSourceInstanceSettings;

const grafanaDsInstanceSettings = {
  name: 'Grafana',
  uid: '-- Grafana --',
  meta: {
    annotations: true,
  } as DataSourcePluginMeta,
  readOnly: false,
  type: 'grafana',
} as DataSourceInstanceSettings;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      //return default datasource when no ref is provided
      getInstanceSettings: (ref: DataSourceRef | string | null) => {
        if (!ref) {
          return new MockDataSourceApi(noAnnotationsDsInstanceSettings);
        }
        if (getDataSourceUID(ref) === '-- Grafana --') {
          return new MockDataSourceApi(grafanaDsInstanceSettings);
        }
        return jest.fn().mockResolvedValue({ uid: 'ds1' });
      },
      get: (ref: DataSourceRef) => {
        if (getDataSourceUID(ref) === 'noAnnotationsDs') {
          return Promise.resolve(new MockDataSourceApi(noAnnotationsDsInstanceSettings));
        }
        if (getDataSourceUID(ref) === '-- Grafana --') {
          return Promise.resolve(new MockDataSourceApi(grafanaDsInstanceSettings));
        }
        return Promise.resolve(new MockDataSourceApi('ds1'));
      },
    };
  },
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    publicDashboardAccessToken: 'ac123',
  },
  getDataSourceInstanceSettings: jest.fn(async (ref: DataSourceRef | string | null) => {
    if (!ref) {
      return noAnnotationsDsInstanceSettings;
    }
    if (getDataSourceUID(ref) === '-- Grafana --') {
      return grafanaDsInstanceSettings;
    }
    return { uid: 'ds1' };
  }),
}));
describe('AnnotationsEditView', () => {
  describe('Dashboard annotations state', () => {
    let annotationsView: AnnotationsEditView;

    beforeEach(async () => {
      const result = await buildTestScene();
      annotationsView = result.annotationsView;
      jest.spyOn(console, 'error').mockImplementation();
    });

    it('should return the correct urlKey', () => {
      expect(annotationsView.getUrlKey()).toBe('annotations');
    });

    it('should return undefined when datasource does not support annotations', async () => {
      const ds = await annotationsView.getDataSourceRefForAnnotation();
      expect(ds).toBe(undefined);
      expect(console.error).toHaveBeenCalledWith('Default datasource does not support annotations');
    });

    it('should add a new annotation and group it with the other annotations', async () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      expect(dataLayers?.state.annotationLayers.length).toBe(1);
      await annotationsView.onNew();

      expect(dataLayers?.state.annotationLayers.length).toBe(2);
      expect(dataLayers?.state.annotationLayers[1].state.name).toBe(NEW_ANNOTATION_NAME);
      expect(dataLayers?.state.annotationLayers[1].isActive).toBe(true);
    });

    it('should move an annotation up one position', async () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      await annotationsView.onNew();

      expect(dataLayers?.state.annotationLayers.length).toBe(2);
      expect(dataLayers?.state.annotationLayers[0].state.name).toBe('test');

      annotationsView.onMove(1, MoveDirection.UP);

      expect(dataLayers?.state.annotationLayers.length).toBe(2);
      expect(dataLayers?.state.annotationLayers[0].state.name).toBe(NEW_ANNOTATION_NAME);
    });

    it('should move an annotation down one position', async () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      await annotationsView.onNew();

      expect(dataLayers?.state.annotationLayers.length).toBe(2);
      expect(dataLayers?.state.annotationLayers[0].state.name).toBe('test');

      annotationsView.onMove(0, MoveDirection.DOWN);

      expect(dataLayers?.state.annotationLayers.length).toBe(2);
      expect(dataLayers?.state.annotationLayers[0].state.name).toBe(NEW_ANNOTATION_NAME);
    });

    it('should delete annotation at index', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      expect(dataLayers?.state.annotationLayers.length).toBe(1);

      annotationsView.onDelete(0);

      expect(dataLayers?.state.annotationLayers.length).toBe(0);
    });

    it('should update an annotation at index', () => {
      const dataLayers = dashboardSceneGraph.getDataLayers(annotationsView.getDashboard());

      expect(dataLayers?.state.annotationLayers[0].state.name).toBe('test');

      const annotation: AnnotationQuery = {
        ...(dataLayers?.state.annotationLayers[0] as dataLayers.AnnotationsDataLayer).state.query,
      };

      annotation.name = 'new name';
      annotation.hide = true;
      annotation.enable = false;
      annotation.iconColor = 'blue';
      annotationsView.onUpdate(annotation, 0);

      expect(dataLayers?.state.annotationLayers.length).toBe(1);
      expect(dataLayers?.state.annotationLayers[0].state.name).toBe('new name');
      expect((dataLayers?.state.annotationLayers[0] as dataLayers.AnnotationsDataLayer).state.query.name).toBe(
        'new name'
      );
      expect((dataLayers?.state.annotationLayers[0] as dataLayers.AnnotationsDataLayer).state.query.hide).toBe(true);
      expect((dataLayers?.state.annotationLayers[0] as dataLayers.AnnotationsDataLayer).state.query.enable).toBe(false);
      expect((dataLayers?.state.annotationLayers[0] as dataLayers.AnnotationsDataLayer).state.query.iconColor).toBe(
        'blue'
      );
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
    $data: new DashboardDataLayerSet({
      annotationLayers: [
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

function renderSidebarRedirect() {
  const view = new AnnotationsEditView({});
  const dashboard = new DashboardScene({
    isEditing: true,
    editview: view,
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
  });
  const user = userEvent.setup();
  const result = render(<AnnotationsEditViewRenderer model={view} />);
  const elements = {
    takeMeThere: () => result.getByRole('button', { name: 'Take me there' }),
  };

  return {
    ...result,
    dashboard,
    user,
    elements,
    actions: {
      async goToSidebar() {
        await user.click(elements.takeMeThere());
      },
    },
  };
}

describe.each([true, false])('AnnotationsEditView with explicit sidebar opening %s', (explicitOpen) => {
  afterEach(cleanup);

  testWithFlags({
    dashboardNewLayouts: true,
    [FlagKeys.GrafanaDashboardSettingsRedesign]: true,
    [FlagKeys.GrafanaDashboardSidebarExplicitOpen]: explicitOpen,
  });

  it('when clicking Take me there with the sidebar closed, opens dashboard settings at annotations', async () => {
    const { dashboard, actions } = renderSidebarRedirect();
    const sidebar = dashboard.state.sidebar;
    expect(sidebar.state.openPane).toBeUndefined();

    await actions.goToSidebar();

    await waitFor(() => expect(sidebar.state.openPane?.getId()).toBe('element'));
    expect(sidebar.getSelectedObject()).toBe(dashboard);
    expect(locationService.getSearchObject()).toMatchObject({
      showCategory: 'dashboard-annotations',
      highlightCategory: 'dashboard-annotations',
    });
  });
});
