import { type SceneObject, VizPanel } from '@grafana/scenes';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';

import { AddPanelToNotebookScene } from './AddPanelToNotebookScene';

function sceneForPanel(behaviors?: SceneObject[]) {
  const panel = new VizPanel({ key: 'panel-1', title: 'CPU', pluginId: 'timeseries', $behaviors: behaviors });

  return new AddPanelToNotebookScene({ panelRef: panel.getRef() });
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
