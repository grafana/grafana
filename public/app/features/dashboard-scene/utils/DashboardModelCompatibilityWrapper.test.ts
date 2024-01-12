import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import {
  behaviors,
  SceneGridItem,
  SceneGridLayout,
  SceneRefreshPicker,
  SceneQueryRunner,
  SceneTimeRange,
  VizPanel,
  SceneTimePicker,
  SceneDataTransformer,
} from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardLinksControls } from '../scene/DashboardLinksControls';
import { DashboardScene } from '../scene/DashboardScene';
import { ShareQueryDataProvider } from '../scene/ShareQueryDataProvider';

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
    expect(wrapper.time.from).toBe('now-6h');
    expect(wrapper.timezone).toBe('America/New_York');
    expect(wrapper.weekStart).toBe('friday');
    expect(wrapper.timepicker.refresh_intervals).toEqual(['1s']);
    expect(wrapper.timepicker.hidden).toEqual(true);
    expect(wrapper.panels).toHaveLength(5);

    expect(wrapper.panels[0].targets).toHaveLength(1);
    expect(wrapper.panels[0].targets[0]).toEqual({ refId: 'A' });
    expect(wrapper.panels[1].targets).toHaveLength(0);
    expect(wrapper.panels[2].targets).toHaveLength(1);
    expect(wrapper.panels[2].targets).toEqual([
      { datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' }, refId: 'A', panelId: 1 },
    ]);
    expect(wrapper.panels[3].targets).toHaveLength(1);
    expect(wrapper.panels[3].targets[0]).toEqual({ refId: 'A' });
    expect(wrapper.panels[4].targets).toHaveLength(1);
    expect(wrapper.panels[4].targets).toEqual([
      { datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' }, refId: 'A', panelId: 1 },
    ]);

    expect(wrapper.panels[0].datasource).toEqual({ uid: 'gdev-testdata', type: 'grafana-testdata-datasource' });
    expect(wrapper.panels[1].datasource).toEqual(null);
    expect(wrapper.panels[2].datasource).toEqual({ uid: SHARED_DASHBOARD_QUERY, type: 'datasource' });
    expect(wrapper.panels[3].datasource).toEqual({ uid: 'gdev-testdata', type: 'grafana-testdata-datasource' });
    expect(wrapper.panels[4].datasource).toEqual({ uid: SHARED_DASHBOARD_QUERY, type: 'datasource' });

    (scene.state.controls![0] as DashboardControls).setState({
      hideTimeControls: false,
    });

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
    const { wrapper, scene } = setup();

    expect((scene.state.body as SceneGridLayout).state.children.length).toBe(5);

    wrapper.removePanel(wrapper.getPanelById(1)!);

    expect((scene.state.body as SceneGridLayout).state.children.length).toBe(4);
  });
});

function setup() {
  const scene = new DashboardScene({
    title: 'hello',
    description: 'hello description',
    tags: ['hello-tag'],
    uid: 'dash-1',
    editable: false,
    $timeRange: new SceneTimeRange({
      weekStart: 'friday',
      timeZone: 'America/New_York',
    }),
    controls: [
      new DashboardControls({
        variableControls: [],
        linkControls: new DashboardLinksControls({}),
        timeControls: [
          new SceneTimePicker({}),
          new SceneRefreshPicker({
            intervals: ['1s'],
          }),
        ],
        hideTimeControls: true,
      }),
    ],
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          body: new VizPanel({
            title: 'Panel with a regular data source query',
            key: 'panel-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({
              key: 'data-query-runner',
              queries: [{ refId: 'A' }],
              datasource: { uid: 'gdev-testdata', type: 'grafana-testdata-datasource' },
            }),
          }),
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel with no queries',
            key: 'panel-2',
            pluginId: 'table',
          }),
        }),

        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel with a shared query',
            key: 'panel-3',
            pluginId: 'table',
            $data: new ShareQueryDataProvider({ query: { refId: 'A', panelId: 1 } }),
          }),
        }),

        new SceneGridItem({
          body: new VizPanel({
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
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel with a shared query and transformations',
            key: 'panel-4',
            pluginId: 'table',
            $data: new SceneDataTransformer({
              $data: new ShareQueryDataProvider({ query: { refId: 'A', panelId: 1 } }),
              transformations: [],
            }),
          }),
        }),
      ],
    }),
  });

  const wrapper = new DashboardModelCompatibilityWrapper(scene);

  return { scene, wrapper };
}
