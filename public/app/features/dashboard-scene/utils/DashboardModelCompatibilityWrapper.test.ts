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
} from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardLinksControls } from '../scene/DashboardLinksControls';
import { DashboardScene } from '../scene/DashboardScene';

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

    expect(wrapper.getPanelById(1)!.title).toBe('Panel A');
    expect(wrapper.getPanelById(2)!.title).toBe('Panel B');
  });

  it('Can remove panel', () => {
    const { wrapper, scene } = setup();

    wrapper.removePanel(wrapper.getPanelById(1)!);

    expect((scene.state.body as SceneGridLayout).state.children.length).toBe(1);
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
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
          }),
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2',
            pluginId: 'table',
          }),
        }),
      ],
    }),
  });

  const wrapper = new DashboardModelCompatibilityWrapper(scene);

  return { scene, wrapper };
}
