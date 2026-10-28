import {
  SceneFlexItem,
  SceneFlexLayout,
  type SceneObject,
  SceneTimeRange,
  type SceneTimeRangeLike,
  VizPanel,
} from '@grafana/scenes';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';
import { PanelTimeRange } from 'app/features/dashboard-scene/scene/panel-timerange/PanelTimeRange';

import { AddPanelToNotebookScene } from './AddPanelToNotebookScene';

function sceneForPanel(behaviors?: SceneObject[], timeRange?: SceneTimeRangeLike, panelTimeRange?: SceneTimeRangeLike) {
  const panel = new VizPanel({
    key: 'panel-1',
    title: 'CPU',
    pluginId: 'timeseries',
    $behaviors: behaviors,
    $timeRange: panelTimeRange,
  });

  let layout: SceneFlexLayout | undefined;
  if (timeRange) {
    // Inside a layout so the panel has to resolve the range through the graph, the way it does on a
    // dashboard, rather than carrying it itself.
    layout = new SceneFlexLayout({ $timeRange: timeRange, children: [new SceneFlexItem({ body: panel })] });
  }

  return Object.assign(new AddPanelToNotebookScene({ panelRef: panel.getRef() }), { layout });
}

function libraryPanelBehavior(isLoaded: boolean) {
  return new LibraryPanelBehavior({ uid: 'lp-1', name: 'shared-cpu', isLoaded });
}

/**
 * buildPanelElementFromDashboard inlines a loaded library panel. The element it returns then reads
 * as an ordinary panel, which reported every library panel as not one.
 *
 * So the flag is read from the panel the menu opened on.
 */
describe('AddPanelToNotebookScene.isLibraryPanel', () => {
  it.each([true, false])('is true for a library panel, whether or not its model has loaded: %p', (isLoaded) => {
    expect(sceneForPanel([libraryPanelBehavior(isLoaded)]).isLibraryPanel()).toBe(true);
  });

  it('is false for an ordinary dashboard panel', () => {
    expect(sceneForPanel().isLibraryPanel()).toBe(false);
  });
});

describe('AddPanelToNotebookScene.getCapturedTimeRange', () => {
  it('reports the dashboard window the panel is showing, with its time zone', () => {
    const scene = sceneForPanel(
      undefined,
      new SceneTimeRange({ from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:30:00.000Z', timeZone: 'utc' })
    );

    expect(scene.getCapturedTimeRange()).toEqual({
      from: '2026-10-05T08:00:00.000Z',
      to: '2026-10-05T09:30:00.000Z',
      timeZone: 'utc',
    });
  });

  it('reports a relative window as the picker wrote it, so nothing is pinned by accident', () => {
    const scene = sceneForPanel(undefined, new SceneTimeRange({ from: 'now-6h', to: 'now', timeZone: 'browser' }));

    expect(scene.getCapturedTimeRange()).toEqual({ from: 'now-6h', to: 'now', timeZone: 'browser' });
  });

  it("follows a panel's relative time after it changes, not the override it had before", () => {
    const panelTimeRange = new PanelTimeRange({ timeFrom: '2h' });
    const scene = sceneForPanel(
      undefined,
      new SceneTimeRange({ from: 'now-6h', to: 'now', timeZone: 'utc' }),
      panelTimeRange
    );

    scene.layout!.state.$timeRange!.activate();
    panelTimeRange.activate();

    panelTimeRange.setState({ timeFrom: '1h' });

    expect(scene.getCapturedTimeRange()).toEqual({ from: 'now-1h', to: 'now', timeZone: 'utc' });
  });
});
