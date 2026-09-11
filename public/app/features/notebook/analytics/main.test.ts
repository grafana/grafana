import { locationService, onInteraction, setEchoSrv } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';

import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';
import { defaultVisualizationPanelKind } from '../types';

import { NotebookAnalytics } from './main';

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
describe('NotebookAnalytics.loaded', () => {
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

    NotebookAnalytics.loaded(notebookScene(), false);

    expect(modes).toEqual(['edit']);
  });

  it('reports view mode without the edit param', () => {
    locationService.push('/notebooks/nb-1');

    NotebookAnalytics.loaded(notebookScene(), false);

    expect(modes).toEqual(['view']);
  });

  // The url sync refuses `?edit=true` for a user without write access, and clears the param. The
  // notebook opens as a read, whatever the link said.
  it('reports view mode for a user who cannot edit, even with the edit param', () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    locationService.push('/notebooks/nb-1?edit=true');

    NotebookAnalytics.loaded(notebookScene(), false);

    expect(modes).toEqual(['view']);
  });

  // Reopening a notebook hands back the cached scene, which still carries the mode of the last visit.
  it('reports view mode for a cached scene left in edit mode when the url asks for a read', () => {
    const scene = notebookScene();
    scene.setState({ isEditing: true });
    locationService.push('/notebooks/nb-1');

    NotebookAnalytics.loaded(scene, true);

    expect(modes).toEqual(['view']);
  });
});

/**
 * The panel properties are read here rather than at the call site, so this asserts the payload that
 * goes out rather than what the caller handed over.
 */
describe('NotebookAnalytics.cellAddedFromAddToNotebook', () => {
  let events: Array<Record<string, unknown>>;
  let unsubscribe: () => void;

  beforeEach(() => {
    setEchoSrv(new Echo());
    events = [];
    unsubscribe = onInteraction('grafana_notebook_cell_added_from_add_to_notebook', (properties) =>
      events.push(properties)
    );
  });

  afterEach(() => unsubscribe());

  it('sends the shape of the added panel next to the notebook and the position', () => {
    NotebookAnalytics.cellAddedFromAddToNotebook('nb-1', 'explore', 2, {
      panel: defaultVisualizationPanelKind(),
      isLibraryPanel: false,
    });

    expect(events).toEqual([
      {
        notebookUid: 'nb-1',
        source: 'explore',
        position: 2,
        panelType: 'timeseries',
        datasourceTypes: [],
        queryCount: 0,
        isLibraryPanel: false,
      },
    ]);
  });

  /**
   * A library panel from a dashboard arrives inlined, as an ordinary Panel element. Reading the flag
   * off that element reported every one of them as not a library panel, so it comes from the caller.
   */
  it('reports a library panel as one even though it arrives inlined', () => {
    NotebookAnalytics.cellAddedFromAddToNotebook('nb-1', 'dashboard_panel', 0, {
      panel: defaultVisualizationPanelKind(),
      isLibraryPanel: true,
    });

    expect(events).toEqual([
      expect.objectContaining({ isLibraryPanel: true, panelType: 'timeseries', source: 'dashboard_panel' }),
    ]);
  });
});

/**
 * The same panel properties as the add event, because a create from "Add to notebook" is the other
 * half of the same action: the panel lands in a notebook that did not exist yet.
 */
describe('NotebookAnalytics.created', () => {
  let events: Array<Record<string, unknown>>;
  let unsubscribe: () => void;

  beforeEach(() => {
    setEchoSrv(new Echo());
    events = [];
    unsubscribe = onInteraction('grafana_notebook_created', (properties) => events.push(properties));
  });

  afterEach(() => unsubscribe());

  it('describes the panel the notebook was created around', () => {
    NotebookAnalytics.created('nb-1', 'dashboard_panel', 1, {
      panel: defaultVisualizationPanelKind(),
      isLibraryPanel: true,
    });

    expect(events).toEqual([
      {
        notebookUid: 'nb-1',
        source: 'dashboard_panel',
        cellCount: 1,
        panelType: 'timeseries',
        datasourceTypes: [],
        queryCount: 0,
        isLibraryPanel: true,
      },
    ]);
  });

  // The blank notebook route creates from whatever cells exist by the first save, so there is no one
  // panel to describe and the four properties are left off rather than sent empty.
  it('sends no panel properties for a create that came with no panel', () => {
    NotebookAnalytics.created('nb-2', 'notebook_list', 3);

    expect(events).toEqual([{ notebookUid: 'nb-2', source: 'notebook_list', cellCount: 3 }]);
  });
});
