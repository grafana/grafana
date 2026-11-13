import { locationService, onInteraction, setEchoSrv } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';

import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';
import { defaultVisualizationPanelKind } from '../types';

import { NotebookAnalytics } from './main';

describe('app capture attribution', () => {
  beforeEach(() => setEchoSrv(new Echo()));

  it.each([
    ['grafana_notebook_add_to_notebook_opened', () => NotebookAnalytics.addToNotebookOpened('plugin', 'agent_o11y')],
    ['grafana_notebook_created', () => NotebookAnalytics.created('nb-1', 'plugin', 1, undefined, true, 'agent_o11y')],
    [
      'grafana_notebook_cell_added_from_add_to_notebook',
      () => NotebookAnalytics.cellAddedFromAddToNotebook('nb-1', 'plugin', 0, undefined, true, 'agent_o11y'),
    ],
    [
      'grafana_notebook_add_to_notebook_failed',
      () => NotebookAnalytics.addToNotebookFailed('nb-1', 'plugin', 'existing', 'write_failed', false, 'agent_o11y'),
    ],
  ] as const)('includes the same source app in %s', (name, emit) => {
    const captured: unknown[] = [];
    const stop = onInteraction(name, (properties) => captured.push(properties));
    emit();
    stop();
    expect(captured).toEqual([expect.objectContaining({ source: 'plugin', source_app: 'agent_o11y' })]);
  });

  it('leaves existing non-plugin analytics unchanged', () => {
    const captured: unknown[] = [];
    const stop = onInteraction('grafana_notebook_created', (properties) => captured.push(properties));
    NotebookAnalytics.created('nb-1', 'explore', 1);
    stop();
    expect(captured[0]).not.toHaveProperty('source_app');
  });
});

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

    NotebookAnalytics.loaded(notebookScene(), false, false, 'direct');

    expect(modes).toEqual(['edit']);
  });

  it('reports view mode without the edit param', () => {
    locationService.push('/notebooks/nb-1');

    NotebookAnalytics.loaded(notebookScene(), false, false, 'direct');

    expect(modes).toEqual(['view']);
  });

  // The url sync refuses `?edit=true` for a user without write access, and clears the param. The
  // notebook opens as a read, whatever the link said.
  it('reports view mode for a user who cannot edit, even with the edit param', () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    locationService.push('/notebooks/nb-1?edit=true');

    NotebookAnalytics.loaded(notebookScene(), false, false, 'direct');

    expect(modes).toEqual(['view']);
  });

  // Reopening a notebook hands back the cached scene, which still carries the mode of the last visit.
  it('reports view mode for a cached scene left in edit mode when the url asks for a read', () => {
    const scene = notebookScene();
    scene.setState({ isEditing: true });
    locationService.push('/notebooks/nb-1');

    NotebookAnalytics.loaded(scene, true, false, 'direct');

    expect(modes).toEqual(['view']);
  });

  it('reports whether a host other than the notebook route is showing the notebook', () => {
    const embedded: unknown[] = [];
    const stop = onInteraction('grafana_notebook_loaded', (properties) => embedded.push(properties.embedded));

    NotebookAnalytics.loaded(notebookScene(), false, false, 'direct');
    NotebookAnalytics.loaded(notebookScene(), false, true, 'direct');
    stop();

    expect(embedded).toEqual([false, true]);
  });

  it('reports where the reader came from', () => {
    const sources: unknown[] = [];
    const stop = onInteraction('grafana_notebook_loaded', (properties) => sources.push(properties.source));

    NotebookAnalytics.loaded(notebookScene(), false, false, 'notebook_list');
    NotebookAnalytics.loaded(notebookScene(), false, false, 'direct');
    stop();

    expect(sources).toEqual(['notebook_list', 'direct']);
  });

  it('reports the languages of the notebook code cells, once each', () => {
    const languages: unknown[] = [];
    const stop = onInteraction('grafana_notebook_loaded', (properties) => languages.push(properties.codeLanguages));
    const scene = notebookScene();
    scene.state.body.setState({
      cells: [
        ...scene.state.body.state.cells,
        new NotebookCellItem({
          elementName: 'sql-1',
          source: 'user',
          content: { kind: 'Code', spec: { code: 'select 1', language: 'sql' } },
        }),
        new NotebookCellItem({
          elementName: 'sql-2',
          source: 'user',
          content: { kind: 'Code', spec: { code: 'select 2', language: 'sql' } },
        }),
        new NotebookCellItem({
          elementName: 'py',
          source: 'user',
          content: { kind: 'Code', spec: { code: 'print(1)', language: 'python' } },
        }),
      ],
    });

    NotebookAnalytics.loaded(scene, false, false, 'direct');
    stop();

    expect(languages).toEqual([['sql', 'python']]);
  });
});

/** The wrapper reads the panel properties, so this asserts the payload that goes out. */
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
    NotebookAnalytics.cellAddedFromAddToNotebook(
      'nb-1',
      'explore',
      2,
      { panel: defaultVisualizationPanelKind(), isLibraryPanel: false },
      true
    );

    expect(events).toEqual([
      {
        notebookUid: 'nb-1',
        source: 'explore',
        position: 2,
        cellType: 'panel',
        target: 'existing',
        lockTimeRange: true,
        schema_version: 1,
        panelType: 'timeseries',
        datasourceTypes: [],
        queryCount: 0,
        isLibraryPanel: false,
      },
    ]);
  });

  /**
   * A library panel arrives inlined, as an ordinary Panel element. Reading the flag off that element
   * reported every library panel as not one. So the flag comes from the caller.
   */
  it('reports a library panel as one even though it arrives inlined', () => {
    NotebookAnalytics.cellAddedFromAddToNotebook(
      'nb-1',
      'dashboard_panel',
      0,
      { panel: defaultVisualizationPanelKind(), isLibraryPanel: true },
      false
    );

    expect(events).toEqual([
      expect.objectContaining({ isLibraryPanel: true, panelType: 'timeseries', source: 'dashboard_panel' }),
    ]);
  });

  // A chat answer brings text next to its panels. There is no panel to describe, so those properties
  // are left off rather than sent empty.
  it('reports a markdown cell with no panel properties', () => {
    NotebookAnalytics.cellAddedFromAddToNotebook('nb-1', 'plugin', 3, undefined, false);

    expect(events).toEqual([
      {
        notebookUid: 'nb-1',
        source: 'plugin',
        position: 3,
        cellType: 'markdown',
        target: 'existing',
        lockTimeRange: false,
        schema_version: 1,
      },
    ]);
  });
});

/**
 * Carries the same panel properties as the add event. A create from "Add to notebook" is the other
 * half of the same action.
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
    NotebookAnalytics.created(
      'nb-1',
      'dashboard_panel',
      1,
      { panel: defaultVisualizationPanelKind(), isLibraryPanel: true },
      true
    );

    expect(events).toEqual([
      {
        notebookUid: 'nb-1',
        source: 'dashboard_panel',
        cellCount: 1,
        target: 'new',
        lockTimeRange: true,
        schema_version: 1,
        panelType: 'timeseries',
        datasourceTypes: [],
        queryCount: 0,
        isLibraryPanel: true,
      },
    ]);
  });

  // The blank notebook route creates from whatever cells exist by the first save. There is no one
  // panel to describe, so the four properties are left off rather than sent empty.
  it('sends no panel properties for a create that came with no panel', () => {
    NotebookAnalytics.created('nb-2', 'notebook_list', 3);

    expect(events).toEqual([{ notebookUid: 'nb-2', source: 'notebook_list', cellCount: 3, schema_version: 1 }]);
  });
});

/** Events with a flat payload, so each is asserted on what goes out. */
describe('NotebookAnalytics prompts, retries, blocks and incidents', () => {
  const captured: Record<string, Array<Record<string, unknown>>> = {};
  const names = [
    'block_inserted',
    'leave_prompt_resolved',
    'view_only_changes_resolved',
    'autosave_retried',
    'incident_action_completed',
  ];
  let unsubscribers: Array<() => void>;

  beforeEach(() => {
    setEchoSrv(new Echo());
    unsubscribers = names.map((name) => {
      captured[name] = [];
      return onInteraction(`grafana_notebook_${name}`, (properties) => captured[name].push(properties));
    });
  });

  afterEach(() => unsubscribers.forEach((unsubscribe) => unsubscribe()));

  it('sends the block and the control that inserted it', () => {
    NotebookAnalytics.blockInserted('nb-1', 'code', 'slash_menu');

    expect(captured.block_inserted).toEqual([
      { notebookUid: 'nb-1', blockType: 'code', via: 'slash_menu', schema_version: 1 },
    ]);
  });

  it('sends why the leave prompt came up and how it was answered', () => {
    NotebookAnalytics.leavePromptResolved('nb-1', 'conflict', 'stay');

    expect(captured.leave_prompt_resolved).toEqual([
      { notebookUid: 'nb-1', reason: 'conflict', resolution: 'stay', schema_version: 1 },
    ]);
  });

  it('sends the answer to the unsaved panel changes prompt with how many panels it was about', () => {
    NotebookAnalytics.viewOnlyChangesResolved('nb-1', 'keep', 2);

    expect(captured.view_only_changes_resolved).toEqual([
      { notebookUid: 'nb-1', resolution: 'keep', changedPanelCount: 2, schema_version: 1 },
    ]);
  });

  it('sends how many saves had failed in a row when Retry was pressed', () => {
    NotebookAnalytics.autosaveRetried('nb-1', 3);

    expect(captured.autosave_retried).toEqual([{ notebookUid: 'nb-1', attempt: 3, schema_version: 1 }]);
  });

  it('sends the IRM action that finished', () => {
    NotebookAnalytics.incidentActionCompleted('nb-1', 'attach');

    expect(captured.incident_action_completed).toEqual([{ notebookUid: 'nb-1', action: 'attach', schema_version: 1 }]);
  });
});
