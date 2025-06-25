import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { behaviors, SceneQueryRunner, SceneTimeRange, VizPanel, SceneDataTransformer } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { NEW_LINK } from '../settings/links/utils';

import { DashboardModelCompatibilityWrapper } from './DashboardModelCompatibilityWrapper';

describe('DashboardModelCompatibilityWrapper', () => {
  it('Provide basic prop and function of compatability', () => {
    const { wrapper, scene } = setup();

    expect(wrapper.uid).toBe('dash-1');
    expect(wrapper.title).toBe('hello');
    expect(wrapper.description).toBe('hello description');
    expect(wrapper.editable).toBe(false);
    expect(wrapper.graphTooltip).toBe(DashboardCursorSync.Off);
    expect(wrapper.tags).toEqual(['hello-tag']);
    expect(wrapper.links).toEqual([NEW_LINK]);
    expect(wrapper.time.from).toBe('now-6h');
    expect(wrapper.timezone).toBe('America/New_York');
    expect(wrapper.weekStart).toBe('saturday');
    expect(wrapper.timepicker.refresh_intervals![0]).toEqual('5s');
    expect(wrapper.timepicker.hidden).toEqual(true);
    expect(wrapper.panels).toHaveLength(5);

    expect(wrapper.annotations.list).toHaveLength(1);
    expect(wrapper.annotations.list[0].name).toBe('test');

    expect(wrapper.panels[0].targets).toHaveLength(1);
    expect(wrapper.panels[0].targets[0]).toEqual({ refId: 'A' });
    expect(wrapper.panels[1].targets).toHaveLength(0);
    expect(wrapper.panels[2].targets).toHaveLength(1);
    expect(wrapper.panels[2].targets).toEqual([{ refId: 'A', panelId: 1 }]);
    expect(wrapper.panels[3].targets).toHaveLength(1);
    expect(wrapper.panels[3].targets[0]).toEqual({ refId: 'A' });
    expect(wrapper.panels[4].targets).toHaveLength(1);
    expect(wrapper.panels[4].targets).toEqual([{ refId: 'A', panelId: 1 }]);

    expect(wrapper.panels[0].datasource).toEqual({ uid: 'gdev-testdata', type: 'grafana-testdata-datasource' });
    expect(wrapper.panels[1].datasource).toEqual(undefined);
    expect(wrapper.panels[2].datasource).toEqual({ uid: SHARED_DASHBOARD_QUERY, type: 'datasource' });
    expect(wrapper.panels[3].datasource).toEqual({ uid: 'gdev-testdata', type: 'grafana-testdata-datasource' });
    expect(wrapper.panels[4].datasource).toEqual({ uid: SHARED_DASHBOARD_QUERY, type: 'datasource' });

    scene.state.controls!.setState({ hideTimeControls: false });

    const wrapper2 = new DashboardModelCompatibilityWrapper(scene);
    expect(wrapper2.timepicker.hidden).toEqual(false);
  });

  it('Shared tooltip functions', () => {
    const { scene, wrapper } = setup();
    expect(wrapper.sharedTooltipModeEnabled()).toBe(false);
    expect(wrapper.sharedCrosshairModeOnly()).toBe(false);

    scene.setState({ $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Crosshair })] });

    expect(wrapper.sharedTooltipModeEnabled()).toBe(true);
    expect(wrapper.sharedCrosshairModeOnly()).toBe(true);
    expect(wrapper.graphTooltip).toBe(DashboardCursorSync.Crosshair);
  });

  it('Get timezone from time range', () => {
    const { wrapper } = setup();
    expect(wrapper.getTimezone()).toBe('America/New_York');
  });

  it('Should emit TimeRangeUpdatedEvent when time range change', () => {
    const { scene, wrapper } = setup();
    let timeChanged = 0;
    wrapper.events.subscribe(TimeRangeUpdatedEvent, () => timeChanged++);

    scene.state.$timeRange!.onRefresh();
    expect(timeChanged).toBe(1);
  });

  it('Can get fake panel with getPanelById', () => {
    const { wrapper } = setup();

    expect(wrapper.getPanelById(1)!.title).toBe('Panel with a regular data source query');
    expect(wrapper.getPanelById(2)!.title).toBe('Panel with no queries');
  });

  it('Can remove panel', () => {
    const { wrapper } = setup();

    expect(wrapper.panels.length).toBe(5);

    wrapper.removePanel(wrapper.getPanelById(1)!);

    expect(wrapper.panels.length).toBe(4);
  });

  it('Checks if annotations are editable', () => {
    const { wrapper, scene } = setup();

    expect(wrapper.canEditAnnotations()).toBe(true);
    expect(wrapper.canEditAnnotations(scene.state.uid)).toBe(false);

    scene.setState({
      meta: {
        canEdit: false,
        canMakeEditable: false,
      },
    });

    expect(wrapper.canEditAnnotations()).toBe(false);
  });
});

function setup() {
  const scene = new DashboardScene({
    title: 'hello',
    description: 'hello description',
    tags: ['hello-tag'],
    links: [NEW_LINK],
    uid: 'dash-1',
    editable: false,
    meta: {
      canEdit: true,
      canMakeEditable: true,
      annotationsPermissions: {
        organization: {
          canEdit: true,
          canAdd: true,
          canDelete: true,
        },
        dashboard: {
          canEdit: false,
          canAdd: false,
          canDelete: false,
        },
      },
    },
    $timeRange: new SceneTimeRange({
      weekStart: 'saturday',
      timeZone: 'America/New_York',
    }),
    $data: new DashboardDataLayerSet({
      annotationLayers: [
        new DashboardAnnotationsDataLayer({
          key: `annotations-test`,
          query: {
            enable: true,
            iconColor: 'red',
            name: 'test',
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
    controls: new DashboardControls({
      hideTimeControls: true,
    }),
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel with a regular data source query',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({
          key: 'data-query-runner',
          queries: [{ refId: 'A' }],
          datasource: { uid: 'gdev-testdata', type: 'grafana-testdata-datasource' },
        }),
      }),
      new VizPanel({
        title: 'Panel with no queries',
        key: 'panel-2',
        pluginId: 'table',
      }),
      new VizPanel({
        title: 'Panel with a shared query',
        key: 'panel-3',
        pluginId: 'table',
        $data: new SceneQueryRunner({
          key: 'data-query-runner',
          queries: [{ refId: 'A', panelId: 1 }],
          datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' },
        }),
      }),
      new VizPanel({
        title: 'Panel with a regular data source query and transformations',
        key: 'panel-4',
        pluginId: 'table',
        $data: new SceneDataTransformer({
          $data: new SceneQueryRunner({
            key: 'data-query-runner',
            queries: [{ refId: 'A' }],
            datasource: { uid: 'gdev-testdata', type: 'grafana-testdata-datasource' },
          }),
          transformations: [],
        }),
      }),
      new VizPanel({
        title: 'Panel with a shared query and transformations',
        key: 'panel-4',
        pluginId: 'table',
        $data: new SceneDataTransformer({
          $data: new SceneQueryRunner({
            key: 'data-query-runner',
            queries: [{ refId: 'A', panelId: 1 }],
            datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' },
          }),
          transformations: [],
        }),
      }),
    ]),
  });

  const wrapper = new DashboardModelCompatibilityWrapper(scene);

  return { scene, wrapper };
}
