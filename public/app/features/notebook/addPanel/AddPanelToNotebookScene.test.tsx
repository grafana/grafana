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
 * The flag is read off the panel the menu opened on rather than off the element the builder returns:
 * buildPanelElementFromDashboard inlines a loaded library panel, so that element reads as an
 * ordinary panel and reported every library panel as not being one.
 */
describe('AddPanelToNotebookScene.isLibraryPanel', () => {
  it.each([true, false])('is true for a library panel, whether or not its model has loaded: %p', (isLoaded) => {
    expect(sceneForPanel([libraryPanelBehavior(isLoaded)]).isLibraryPanel()).toBe(true);
  });

  it('is false for an ordinary dashboard panel', () => {
    expect(sceneForPanel().isLibraryPanel()).toBe(false);
  });
});
