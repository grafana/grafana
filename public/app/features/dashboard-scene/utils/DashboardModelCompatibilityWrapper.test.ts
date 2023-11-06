import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { behaviors, SceneGridItem, SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardModelCompatibilityWrapper } from './DashboardModelCompatibilityWrapper';

describe('DashboardModelCompatibilityWrapper', () => {
  it('Provide basic prop and function of compatability', () => {
    const { wrapper } = setup();

    expect(wrapper.uid).toBe('dash-1');
    expect(wrapper.title).toBe('hello');

    expect(wrapper.time.from).toBe('now-6h');
  });

  it('Shared tooltip functions', () => {
    const { scene, wrapper } = setup();
    expect(wrapper.sharedTooltipModeEnabled()).toBe(false);
    expect(wrapper.sharedCrosshairModeOnly()).toBe(false);

    scene.setState({ $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Crosshair })] });

    expect(wrapper.sharedTooltipModeEnabled()).toBe(true);
    expect(wrapper.sharedCrosshairModeOnly()).toBe(true);
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
});

function setup() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({
      timeZone: 'America/New_York',
    }),
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
