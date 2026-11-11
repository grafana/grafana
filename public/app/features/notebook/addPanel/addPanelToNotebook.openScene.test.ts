import { rangeUtil } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { getPanelPluginMetasMap } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_ENTRY_POINT } from '../analytics/types';
import {
  notebookResourceFor,
  readNotebookResourceVersion,
  updateNotebook,
  updateNotebookSpec,
} from '../api/notebookResource';
import { NOTEBOOKS_FLAG, cellNamesOf, markdownCell, notebookSpec, panelCell } from '../mutation-api/test-utils';
import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';
import { defaultPanelKind } from '../types';

import { addPanelErrorMessage, addToExistingNotebook, OpenNotebookConflictError } from './addPanelToNotebook';

jest.mock('../api/notebookResource', () => ({
  ...jest.requireActual('../api/notebookResource'),
  updateNotebook: jest.fn(),
  updateNotebookSpec: jest.fn(),
  readNotebookResourceVersion: jest.fn(),
}));

// Real by default; one test makes an edit while the write is waiting on it.
jest.mock('@grafana/runtime/internal', () => {
  const actual = jest.requireActual('@grafana/runtime/internal');
  return { ...actual, getPanelPluginMetasMap: jest.fn(actual.getPanelPluginMetasMap) };
});

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id }).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

const deactivations: Array<() => void> = [];

function openNotebook(uid = 'nb-1'): NotebookScene {
  const scene = transformNotebookToScene(
    notebookResourceFor(uid, notebookSpec({ elements: { intro: markdownCell('## Intro') }, cells: ['intro'] }))
  );
  deactivations.push(scene.activate());
  return scene;
}

function cellContents(scene: NotebookScene): unknown[] {
  return scene.state.body.state.cells.map((cell) => cell.state.content);
}

beforeEach(() => {
  setTestFlags({ [NOTEBOOKS_FLAG]: true });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.mocked(updateNotebook).mockReset().mockResolvedValue({ generation: 2, resourceVersion: '6' });
  jest.mocked(updateNotebookSpec).mockReset();
  jest.mocked(readNotebookResourceVersion).mockReset().mockResolvedValue(undefined);
  jest.spyOn(NotebookAnalytics, 'cellAddedFromAddToNotebook').mockImplementation(() => {});
});

afterEach(() => {
  deactivations.splice(0).forEach((deactivate) => deactivate());
  setTestFlags({});
  jest.restoreAllMocks();
});

describe('adding to a notebook that is open', () => {
  it('appends through the open scene so it updates without a reload, and saves it from there', async () => {
    const scene = openNotebook();

    const added = await addToExistingNotebook(
      'nb-1',
      [
        { kind: 'markdown', text: 'Latency rose.' },
        { kind: 'markdown', text: 'It recovered.' },
      ],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'assistant'
    );

    expect(added).toEqual({ uid: 'nb-1', title: scene.state.title });
    expect(cellContents(scene)).toEqual([
      { kind: 'Markdown', spec: { text: '## Intro' } },
      { kind: 'Markdown', spec: { text: 'Latency rose.' } },
      { kind: 'Markdown', spec: { text: 'It recovered.' } },
    ]);
    expect(scene.state.body.state.cells.slice(1).map((cell) => cell.state.source)).toEqual(['assistant', 'assistant']);
    expect(updateNotebookSpec).not.toHaveBeenCalled();
    expect(updateNotebook).toHaveBeenCalledTimes(1);
  });

  // Someone reading the notebook when content lands in it can carry on editing what arrived.
  it('switches a notebook being read into edit mode', async () => {
    const scene = openNotebook();
    expect(scene.state.isEditing).toBeFalsy();

    await addToExistingNotebook('nb-1', [{ kind: 'markdown', text: 'Hi.' }], NOTEBOOK_ENTRY_POINT.EXPLORE, 'user');

    expect(scene.state.isEditing).toBe(true);
  });

  it('keeps both of two adds made at once, in the order they were made', async () => {
    const scene = openNotebook();

    await Promise.all([
      addToExistingNotebook('nb-1', [{ kind: 'markdown', text: 'First.' }], NOTEBOOK_ENTRY_POINT.EXPLORE, 'user'),
      addToExistingNotebook('nb-1', [{ kind: 'markdown', text: 'Second.' }], NOTEBOOK_ENTRY_POINT.EXPLORE, 'user'),
    ]);

    expect(cellContents(scene)).toEqual([
      { kind: 'Markdown', spec: { text: '## Intro' } },
      { kind: 'Markdown', spec: { text: 'First.' } },
      { kind: 'Markdown', spec: { text: 'Second.' } },
    ]);
  });

  it('keeps an edit made while the add was still loading', async () => {
    const scene = openNotebook();
    const loadMetas = jest.requireActual('@grafana/runtime/internal').getPanelPluginMetasMap;
    jest.mocked(getPanelPluginMetasMap).mockImplementationOnce(async () => {
      scene.state.body.setCellContent(scene.state.body.state.cells[0], {
        kind: 'Markdown',
        spec: { text: '## Edited intro' },
      });
      return loadMetas();
    });

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(cellContents(scene)).toEqual([
      { kind: 'Markdown', spec: { text: '## Edited intro' } },
      { kind: 'Markdown', spec: { text: 'Latency rose.' } },
    ]);
  });

  // Its autosave has stopped by then, so inserting into it would report an add that is never saved.
  it('writes through the API when the notebook closes while the add is loading', async () => {
    const scene = openNotebook();
    const loadMetas = jest.requireActual('@grafana/runtime/internal').getPanelPluginMetasMap;
    jest.mocked(getPanelPluginMetasMap).mockImplementationOnce(async () => {
      deactivations.splice(0).forEach((deactivate) => deactivate());
      return loadMetas();
    });
    jest.mocked(updateNotebookSpec).mockResolvedValue(notebookSpec());

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(updateNotebookSpec).toHaveBeenCalledTimes(1);
    expect(cellContents(scene)).toEqual([{ kind: 'Markdown', spec: { text: '## Intro' } }]);
    expect(updateNotebook).not.toHaveBeenCalled();
  });

  it('lets the closing save land before writing through the API, so the two do not conflict', async () => {
    const scene = openNotebook();
    const loadMetas = jest.requireActual('@grafana/runtime/internal').getPanelPluginMetasMap;
    let closingSaveLanded = false;
    jest.mocked(updateNotebook).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            closingSaveLanded = true;
            resolve({ generation: 3, resourceVersion: '7' });
          }, 0)
        )
    );
    jest.mocked(getPanelPluginMetasMap).mockImplementationOnce(async () => {
      scene.onEnterEditMode();
      scene.state.body.setCellContent(scene.state.body.state.cells[0], {
        kind: 'Markdown',
        spec: { text: '## Edited before closing' },
      });
      deactivations.splice(0).forEach((deactivate) => deactivate());
      return loadMetas();
    });
    let landedBeforeApiWrite: boolean | undefined;
    jest.mocked(updateNotebookSpec).mockImplementation(async () => {
      landedBeforeApiWrite = closingSaveLanded;
      return notebookSpec();
    });

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(landedBeforeApiWrite).toBe(true);
  });

  it('writes through the API rather than report a conflict for a notebook that closed', async () => {
    const scene = openNotebook();
    scene.autosave.setState({ savedResourceVersion: '5' });
    jest.mocked(readNotebookResourceVersion).mockResolvedValue('9');
    const loadMetas = jest.requireActual('@grafana/runtime/internal').getPanelPluginMetasMap;
    jest.mocked(getPanelPluginMetasMap).mockImplementationOnce(async () => {
      deactivations.splice(0).forEach((deactivate) => deactivate());
      return loadMetas();
    });
    jest.mocked(updateNotebookSpec).mockResolvedValue(notebookSpec());

    await expect(
      addToExistingNotebook('nb-1', [{ kind: 'markdown', text: 'Latency rose.' }], NOTEBOOK_ENTRY_POINT.EXPLORE, 'user')
    ).resolves.toMatchObject({ uid: 'nb-1' });
    expect(updateNotebookSpec).toHaveBeenCalledTimes(1);
  });

  it("keeps a reader's own time range out of the notebook it saves", async () => {
    const scene = openNotebook();
    const savedTimeSettings = transformNotebookSceneToSaveModel(scene).timeSettings;
    scene.state.$timeRange.onTimeRangeChange(rangeUtil.convertRawToRange({ from: 'now-1h', to: 'now' }));

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    const written = jest.mocked(updateNotebook).mock.calls[0][1];
    expect(written.timeSettings).toEqual(savedTimeSettings);
    expect(written.timeSettings.from).not.toBe('now-1h');
  });

  it("leaves a reader's own time range on screen", async () => {
    const scene = openNotebook();
    scene.state.$timeRange.onTimeRangeChange(rangeUtil.convertRawToRange({ from: 'now-1h', to: 'now' }));

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(scene.state.$timeRange.state.from).toBe('now-1h');
  });

  it("keeps a reader's own panel changes on screen and out of the notebook it saves", async () => {
    const scene = transformNotebookToScene(
      notebookResourceFor(
        'nb-1',
        notebookSpec({ elements: { latency: panelCell(1, 'p95 latency') }, cells: ['latency'] })
      )
    );
    deactivations.push(scene.activate());
    const panel = scene.state.body.state.cells[0].state.body;
    if (!panel) {
      throw new Error('expected a panel cell');
    }
    const override = { matcher: { id: 'byName', options: 'up' }, properties: [{ id: 'color', value: 'red' }] };
    panel.setState({ fieldConfig: { defaults: {}, overrides: [override] } });

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(scene.state.body.state.cells[0].state.body?.state.fieldConfig.overrides).toEqual([override]);
    const written = jest.mocked(updateNotebook).mock.calls[0][1].elements.latency;
    expect(written.kind === 'Panel' && written.spec.vizConfig.spec.fieldConfig.overrides).toEqual([]);
  });

  it("never reuses the trailing empty block's name for an added cell", async () => {
    const scene = openNotebook();
    const slot = scene.state.body.appendSystemCell(scene.state.body.state.cells.length);
    if (!slot) {
      throw new Error('expected the trailing empty block');
    }
    const panel = defaultPanelKind();

    await addToExistingNotebook(
      'nb-1',
      [
        {
          kind: 'panel',
          panel: { ...panel, spec: { ...panel.spec, title: slot.state.elementName } },
          isLibraryPanel: false,
        },
      ],
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL
    );

    const names = cellNamesOf(scene);
    expect(new Set(names).size).toBe(names.length);
    expect(names.at(-1)).toBe(slot.state.elementName);
  });

  it('lands as one undoable step named for the add', async () => {
    const scene = openNotebook();

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(scene.editHistory.state.undoLabel).toBe('Add to notebook');
    scene.editHistory.undo();
    expect(cellNamesOf(scene)).toEqual(['intro']);
  });

  it('reports a single panel at the position it landed on', async () => {
    openNotebook();
    const panel = defaultPanelKind();

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'panel', panel: panel, isLibraryPanel: false }],
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL
    );

    expect(NotebookAnalytics.cellAddedFromAddToNotebook).toHaveBeenCalledWith(
      'nb-1',
      NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL,
      1,
      expect.objectContaining({ isLibraryPanel: false }),
      false
    );
  });

  it('changes nothing and says to reload when someone else saved it since it was opened', async () => {
    const scene = openNotebook();
    scene.autosave.setState({ savedResourceVersion: '5' });
    jest.mocked(readNotebookResourceVersion).mockResolvedValue('6');

    const adding = addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    await expect(adding).rejects.toBeInstanceOf(OpenNotebookConflictError);
    expect(cellNamesOf(scene)).toEqual(['intro']);
    expect(updateNotebook).not.toHaveBeenCalled();
    expect(addPanelErrorMessage(new OpenNotebookConflictError())).toMatch(/Reload it/);
  });

  it('counts as added when the open notebook takes the cells but its save fails, so a retry cannot duplicate them', async () => {
    const scene = openNotebook();
    jest.mocked(updateNotebook).mockRejectedValue(new Error('apiserver unavailable'));

    const added = await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(added.uid).toBe('nb-1');
    expect(cellNamesOf(scene)).toHaveLength(2);
    expect(scene.autosave.state.status).toBe('error');
  });

  it('writes through the API when the notebook is not open anywhere', async () => {
    openNotebook('nb-other');
    jest.mocked(updateNotebookSpec).mockResolvedValue(notebookSpec());

    await addToExistingNotebook(
      'nb-1',
      [{ kind: 'markdown', text: 'Latency rose.' }],
      NOTEBOOK_ENTRY_POINT.EXPLORE,
      'user'
    );

    expect(updateNotebookSpec).toHaveBeenCalledWith('nb-1', expect.any(Function));
  });
});
