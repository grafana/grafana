import { locationService, onInteraction, setEchoSrv } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';

import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { notebookAnalytics } from './main';

function notebookScene(): NotebookScene {
  const cell = new NotebookCellItem({
    elementName: 'intro',
    source: 'user',
    content: { kind: 'Markdown', spec: { text: 'hello' } },
  });

  return new NotebookScene({
    title: 'My notebook',
    uid: 'nb-1',
    body: new NotebookLayoutManager({ cells: [cell], $timeRange: new SceneTimeRange({}) }),
    $timeRange: new SceneTimeRange({}),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

/**
 * The url decides the mode, not the scene. `loaded` fires while the notebook still loads, before
 * the page mounts the scene and syncs edit mode onto it.
 */
describe('notebookAnalytics.loaded', () => {
  let modes: unknown[];
  let unsubscribe: () => void;

  beforeEach(() => {
    setEchoSrv(new Echo());
    modes = [];
    unsubscribe = onInteraction('grafana_notebook_loaded', (properties) => modes.push(properties.mode));
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    unsubscribe();
    jest.restoreAllMocks();
  });

  it('reports edit mode when the url opened the notebook in edit mode', () => {
    locationService.push('/notebooks/nb-1?edit=true');

    notebookAnalytics.loaded(notebookScene(), false);

    expect(modes).toEqual(['edit']);
  });

  it('reports view mode without the edit param', () => {
    locationService.push('/notebooks/nb-1');

    notebookAnalytics.loaded(notebookScene(), false);

    expect(modes).toEqual(['view']);
  });

  // The url sync refuses `?edit=true` for a user without write access, and clears the param. The
  // notebook opens as a read, whatever the link said.
  it('reports view mode for a user who cannot edit, even with the edit param', () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    locationService.push('/notebooks/nb-1?edit=true');

    notebookAnalytics.loaded(notebookScene(), false);

    expect(modes).toEqual(['view']);
  });

  // Reopening a notebook hands back the cached scene, which still carries the mode of the last visit.
  it('reports view mode for a cached scene left in edit mode when the url asks for a read', () => {
    const scene = notebookScene();
    scene.setState({ isEditing: true });
    locationService.push('/notebooks/nb-1');

    notebookAnalytics.loaded(scene, true);

    expect(modes).toEqual(['view']);
  });
});
