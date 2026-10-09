import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneObjectBase, type VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { notebookResourceFor, updateNotebook } from '../../api/notebookResource';
import { NOTEBOOK_EDIT_KIND } from '../../scene/NotebookEditHistory';
import { NotebookLayoutManager } from '../../scene/layout-notebook/NotebookLayoutManager';
import { transformNotebookToScene } from '../../serialization/transformNotebookToScene';
import { NotebookMutationClient } from '../NotebookMutationClient';
import {
  NOTEBOOKS_FLAG,
  cellNamesOf,
  codeCell,
  markdownCell,
  notebookScene,
  notebookSpec,
  panelCell,
} from '../test-utils';

// Only the network write is stubbed. `notebookResourceFor` and everything else in the module stay real,
// so the spec these tests assert on is the one that would be sent.
jest.mock('../../api/notebookResource', () => ({
  ...jest.requireActual('../../api/notebookResource'),
  updateNotebook: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id }).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

/** Concrete stand-in: SceneObjectBase is abstract, and overlay just needs a SceneObject. */
class TestOverlay extends SceneObjectBase {}

describe('APPLY_NOTEBOOK_SPEC', () => {
  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    jest.mocked(updateNotebook).mockReset().mockResolvedValue({ generation: 2 });
  });

  afterEach(() => {
    setTestFlags({});
    jest.restoreAllMocks();
  });

  it('replaces the document: cell order, content and count', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);

    const next = notebookSpec({
      elements: {
        summary: markdownCell('## Resolved'),
        'latency-panel': panelCell(1, 'p95 latency'),
      },
      cells: ['latency-panel', 'summary'],
    });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(result.success).toBe(true);
    expect(cellNamesOf(scene)).toEqual(['latency-panel', 'summary']);
    expect(scene.state.body.state.cells[1].state.content).toEqual({
      kind: 'Markdown',
      spec: { text: '## Resolved' },
    });
  });

  it('restores the document header from the applied spec', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);

    const next = notebookSpec({ title: 'Postmortem', tags: ['resolved'] });
    await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(scene.state.title).toBe('Postmortem');
    // The rebuild replaces the layout manager, which holds the header on its own state.
    expect(scene.state.body.state.title).toBe('Postmortem');
    expect(scene.state.body.state.tags).toEqual(['resolved']);
  });

  it('keeps the scene key so the client keeps pointing at the same object', async () => {
    const scene = notebookScene();
    const key = scene.state.key;
    const client = new NotebookMutationClient(scene);

    await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: notebookSpec({ title: 'Renamed' }) } });

    expect(scene.state.key).toBe(key);
    // Same client instance still reaches the mutated scene.
    const read = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing the command's own result shape
    expect((read.data as { spec: { title: string } }).spec.title).toBe('Renamed');
  });

  it('echoes the applied spec, so a caller does not need a follow-up read', async () => {
    const client = new NotebookMutationClient(notebookScene());
    const next = notebookSpec({ title: 'Echoed' });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(result.data).toEqual({ applied: true, spec: next });
  });

  it("echoes the save's resourceVersion, so a caller does not need a follow-up read to learn the new revision", async () => {
    jest.mocked(updateNotebook).mockResolvedValue({ generation: 2, resourceVersion: '1756' });
    const client = new NotebookMutationClient(notebookScene());
    const next = notebookSpec({ title: 'Echoed' });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(result.data).toEqual({ applied: true, spec: next, resourceVersion: '1756' });
  });

  it('warns about a cell it silently dropped', async () => {
    const client = new NotebookMutationClient(notebookScene());

    // 'ghost' is referenced by the layout but absent from elements: the deserializer skips it, so without
    // the warning this write reports plain success one cell short.
    const next = notebookSpec({
      elements: { intro: markdownCell('## Intro') },
      cells: ['intro', 'ghost'],
    });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(['These cells were not applied and are missing from the notebook: ghost.']);
  });

  // The save model leaves out the empty block the editor keeps at the bottom, so a caller that sends one
  // would otherwise be told its cell went missing when nothing did.
  it('does not warn about a trailing empty block it was asked to apply', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const next = notebookSpec({
      elements: { intro: markdownCell('## Intro'), trailing: markdownCell('') },
      cells: ['intro', 'trailing'],
    });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(result.success).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  // The exemption has to be precise: excusing the trailing block must not excuse a cell genuinely lost
  // from in front of it. 'ghost' is referenced with no element, so it really does go missing.
  it('still warns about a lost cell sitting in front of a trailing empty block', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const next = notebookSpec({
      elements: { intro: markdownCell('## Intro'), trailing: markdownCell('') },
      cells: ['intro', 'ghost', 'trailing'],
    });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(result.warnings).toEqual(['These cells were not applied and are missing from the notebook: ghost.']);
  });

  it('leaves the uid alone, including when the notebook has none', async () => {
    const withUid = notebookScene();
    await new NotebookMutationClient(withUid).execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ title: 'Renamed' }) },
    });

    // An apply replaces the contents, not the identity of the document.
    expect(withUid.state.uid).toBe('nb-1');

    // Built here rather than through the fixture, whose `uid` default swallows an explicit undefined.
    const withoutUid = transformNotebookToScene(notebookResourceFor(undefined, notebookSpec()));
    withoutUid.activate();
    await new NotebookMutationClient(withoutUid).execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ title: 'Renamed' }) },
    });

    expect(withoutUid.state.uid).toBeUndefined();
  });

  it('passes the schema warnings through on a validated write', async () => {
    const client = new NotebookMutationClient(notebookScene());

    // An element no cell references: a warning rather than an error.
    const next = notebookSpec({
      elements: { intro: markdownCell('## Intro'), orphan: markdownCell('unused') },
      cells: ['intro'],
    });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next, validate: true } });

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      'elements.orphan: not referenced by any cell in layout.spec.cells, so it will not render',
    ]);
  });

  // The save serializes the same scene, so a serializer that throws stops the write as well as the check.
  it('says so when it cannot tell which cells survived, and that nothing was saved', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);
    // Spied on the prototype because the rebuild swaps in a new layout manager, so the instance the scene
    // starts with is not the one that gets serialized.
    jest.spyOn(NotebookLayoutManager.prototype, 'serialize').mockImplementation(() => {
      throw new Error('cannot serialize');
    });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: notebookSpec() } });

    expect(result.success).toBe(false);
    expect(result.error).toContain('could not be saved');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing the command's own result shape
    expect((result.data as { spec?: unknown }).spec).toBeUndefined();
    expect(result.warnings).toEqual([
      'The notebook could not be checked after the write, so it is unknown which cells survived it.',
    ]);
  });

  it('still reports success when the dropped-cell check itself fails', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);

    // A Set survives the dispatcher's structuredClone and is iterable, so the rebuild walks it and the
    // write lands, and then the comparison calls .map on it and throws. Reporting `success: false` there
    // would say nothing happened to a notebook that has already changed.
    const spec = notebookSpec({ elements: { intro: markdownCell('## Intro') }, cells: ['intro'] });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- exercising a payload shape only an unvalidated caller can produce
    spec.layout.spec.cells = new Set(spec.layout.spec.cells) as unknown as typeof spec.layout.spec.cells;

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec } });

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      'The notebook could not be checked after the write, so it is unknown which cells survived it.',
    ]);
  });

  it('rejects an unknown payload key rather than ignoring it', async () => {
    const scene = notebookScene();
    const before = cellNamesOf(scene);
    const client = new NotebookMutationClient(scene);

    // A mistyped `validate` would otherwise apply the spec with validation off, the path that loses a cell.
    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec(), validat: true },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
    expect(cellNamesOf(scene)).toEqual(before);
  });

  it('rejects a dangling reference outright when asked to validate', async () => {
    const scene = notebookScene();
    const before = cellNamesOf(scene);
    const client = new NotebookMutationClient(scene);

    const next = notebookSpec({ elements: { intro: markdownCell('## Intro') }, cells: ['intro', 'ghost'] });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next, validate: true } });

    expect(result.success).toBe(false);
    expect(result.error).toContain('no element named "ghost"');
    // Rejected before mutating: the document is untouched.
    expect(cellNamesOf(scene)).toEqual(before);
  });

  it('rejects a structurally invalid spec when asked to validate', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: { title: 'no layout' }, validate: true },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('keeps auto-refresh running after the rebuild swaps the refresh picker', async () => {
    // With the time controls hidden nothing renders the picker, so NotebookScene activates it itself.
    const scene = notebookScene(notebookSpec({ hideTimepicker: true, autoRefresh: '30s' }));
    const before = scene.state.refreshPicker;
    expect(before.isActive).toBe(true);

    const client = new NotebookMutationClient(scene);
    await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ hideTimepicker: true, autoRefresh: '1m' }) },
    });

    expect(scene.state.refreshPicker).not.toBe(before);
    expect(scene.state.refreshPicker.state.refresh).toBe('1m');
    expect(scene.state.refreshPicker.isActive).toBe(true);
    expect(before.isActive).toBe(false);
  });

  // setState merges, so an overlay opened against the old tree would stay mounted after the swap.
  it('closes an open overlay so it cannot keep showing cells the apply discarded', async () => {
    const scene = notebookScene();
    scene.showModal(new TestOverlay({}));

    const client = new NotebookMutationClient(scene);
    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
    });

    expect(result.success).toBe(true);
    expect(scene.state.overlay).toBeUndefined();
  });

  // setState merges, so the rebuild keeps `isEditing: true` on the scene while handing it a fresh body
  // with no edit state.
  it('keeps the rebuilt body in edit mode when the notebook was being edited', async () => {
    const scene = notebookScene();
    scene.onEnterEditMode();
    expect(scene.state.isEditing).toBe(true);
    expect(scene.state.body.state.isEditing).toBe(true);
    const before = scene.state.body;

    const client = new NotebookMutationClient(scene);
    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
    });

    expect(result.success).toBe(true);
    expect(scene.state.body).not.toBe(before);
    // The header and the cells must not disagree about the mode.
    expect(scene.state.isEditing).toBe(true);
    expect(scene.state.body.state.isEditing).toBe(true);
  });

  it('enters edit mode for the rebuilt body when the notebook was not being edited', async () => {
    const scene = notebookScene();
    expect(scene.state.isEditing).toBeFalsy();

    const client = new NotebookMutationClient(scene);
    await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
    });

    // The assistant/workspace writing the notebook puts it into edit mode, same as a person clicking
    // the toolbar's Edit toggle would, rather than leaving the toggle saying View over changed cells.
    expect(scene.state.isEditing).toBe(true);
    expect(scene.state.body.state.isEditing).toBe(true);
  });

  it('saves the applied change, which the explicit saveDocumentChange call guarantees regardless of debounce', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);

    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { summary: markdownCell('## Resolved') }, cells: ['summary'] }) },
    });

    expect(result.success).toBe(true);
    // Entering edit mode is itself part of the write; nothing undoes it once the spec is applied.
    expect(scene.state.isEditing).toBe(true);
    // Asserted on the request, not on a call to autosave, so what was sent is what the caller asked for.
    expect(updateNotebook).toHaveBeenCalledTimes(1);
    const [, sent] = jest.mocked(updateNotebook).mock.calls[0];
    expect(sent.layout.spec.cells.map((cell) => cell.spec.element.name)).toEqual(['summary']);
  });

  describe('undo/redo', () => {
    it('undoes an assistant write back to the document that was there before it', async () => {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);
      const before = cellNamesOf(scene);
      const beforeTitle = scene.state.title;
      expect(scene.editHistory.state.canUndo).toBe(false);

      const result = await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: {
          spec: notebookSpec({ title: 'Renamed', elements: { only: markdownCell('## After') }, cells: ['only'] }),
        },
      });

      expect(result.success).toBe(true);
      expect(scene.editHistory.state.canUndo).toBe(true);

      scene.editHistory.undo();

      expect(scene.state.title).toBe(beforeTitle);
      expect(cellNamesOf(scene)).toEqual(before);
      // Undoing the content doesn't flip the toggle back to View: entering edit mode isn't part of
      // what this undo step is undoing.
      expect(scene.state.isEditing).toBe(true);
    });

    it('records the write under NOTEBOOK_EDIT_KIND.EDIT', async () => {
      const scene = notebookScene();
      const executeSpy = jest.spyOn(scene.editHistory, 'execute');
      const client = new NotebookMutationClient(scene);

      await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
      });

      expect(executeSpy).toHaveBeenCalledWith(expect.objectContaining({ kind: NOTEBOOK_EDIT_KIND.EDIT }));
    });

    it('redoes an undone assistant write', async () => {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);

      await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
      });
      const afterApply = cellNamesOf(scene);

      scene.editHistory.undo();
      expect(scene.editHistory.state.canRedo).toBe(true);

      scene.editHistory.redo();

      expect(cellNamesOf(scene)).toEqual(afterApply);
      expect(scene.editHistory.state.canRedo).toBe(false);
    });

    it('keeps an earlier assistant write undoable after a second one', async () => {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);
      const beforeTitle = scene.state.title;

      await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: {
          spec: notebookSpec({ title: 'First', elements: { only: markdownCell('## First') }, cells: ['only'] }),
        },
      });
      await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: {
          spec: notebookSpec({ title: 'Second', elements: { only: markdownCell('## Second') }, cells: ['only'] }),
        },
      });

      expect(scene.editHistory.undo()).toBe(true); // undoes the second write
      expect(scene.state.title).toBe('First');

      expect(scene.editHistory.undo()).toBe(true); // undoes the first write too
      expect(scene.state.title).toBe(beforeTitle);
    });

    // The assistant's write is one entry among others, like any other edit: a manual change from
    // before it, the write itself, and a manual change after it all stay independently reachable in
    // strict LIFO order. Undoing the write swaps the body back without disturbing what's above or
    // below it on either stack — there is nothing here that treats a body swap specially.
    it('undoes and redoes a full stack of manual edits around an assistant write, in strict LIFO order', async () => {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);
      const tagsBeforeAnything = scene.state.tags;

      scene.onEnterEditMode();
      scene.onTagsChange([...(scene.state.tags ?? []), 'before']);
      const tagsAfterBefore = scene.state.tags;

      await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
      });
      const afterApply = cellNamesOf(scene);

      // A manual edit after the write, recorded on top of it.
      scene.onTagsChange([...(scene.state.tags ?? []), 'after']);
      const afterManualEdit = scene.state.tags;

      scene.editHistory.undo(); // undoes the manual tag edit made after the write
      expect(scene.editHistory.state.canRedo).toBe(true);

      scene.editHistory.undo(); // undoes the assistant write — swaps the body back
      // The edit from before the write was never discarded: it's still reachable underneath.
      expect(scene.editHistory.state.canUndo).toBe(true);

      scene.editHistory.undo(); // undoes the edit from before the write too
      expect(scene.editHistory.state.canUndo).toBe(false);
      expect(scene.state.tags).toEqual(tagsBeforeAnything);

      scene.editHistory.redo(); // redoes the edit from before the write
      expect(scene.state.tags).toEqual(tagsAfterBefore);

      scene.editHistory.redo(); // redoes the assistant write
      expect(cellNamesOf(scene)).toEqual(afterApply);
      expect(scene.editHistory.state.canRedo).toBe(true);

      scene.editHistory.redo(); // redoes the manual edit made after the write
      expect(scene.state.tags).toEqual(afterManualEdit);
      expect(scene.editHistory.state.canRedo).toBe(false);
    });
  });

  // The scene already shows the new document, but nothing durable happened. A caller told this succeeded
  // would tell someone their notebook was written when the server never got it.
  it('reports a failure when the applied change could not be saved', async () => {
    jest.mocked(updateNotebook).mockRejectedValue(new Error('The notebook was changed by someone else.'));
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);

    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { summary: markdownCell('## Resolved') }, cells: ['summary'] }) },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('The notebook was changed by someone else.');
  });

  it('is refused without dashboard write permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    const scene = notebookScene();
    const before = cellNamesOf(scene);
    const client = new NotebookMutationClient(scene);

    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { only: codeCell('1') }, cells: ['only'] }) },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('insufficient permissions');
    expect(cellNamesOf(scene)).toEqual(before);
  });

  describe('when the reader has an unsaved view-only panel change', () => {
    function recolour(panel: VizPanel, color = 'red') {
      panel.setState({
        fieldConfig: {
          defaults: {},
          overrides: [
            {
              matcher: { id: 'byName', options: 'up' },
              properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: color } }],
            },
          ],
        },
      });
    }

    /** `latency-panel` recoloured while the notebook is in view mode, mirroring a reader using it. */
    async function sceneWithPendingChange() {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);
      const cell = scene.state.body.state.cells.find((c) => c.state.elementName === 'latency-panel');

      const panel = cell!.state.body as VizPanel;
      const stopPanel = panel.activate();

      recolour(panel);

      return { scene, client, panel, stopPanel };
    }

    it('is refused and leaves the notebook untouched when the change is not resolved', async () => {
      const { scene, client, stopPanel } = await sceneWithPendingChange();
      const before = cellNamesOf(scene);

      const result = await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('latency-panel');
      expect(cellNamesOf(scene)).toEqual(before);
      expect(scene.state.isEditing).toBeFalsy();
      expect(updateNotebook).not.toHaveBeenCalled();

      stopPanel();
    });

    it('saves the reader’s look when told to keep it', async () => {
      const { client, stopPanel } = await sceneWithPendingChange();

      const result = await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: { spec: notebookSpec(), viewOnlyChanges: 'keep' },
      });

      expect(result.success).toBe(true);
      expect(updateNotebook).toHaveBeenCalledTimes(1);
      const [, sent] = jest.mocked(updateNotebook).mock.calls[0];
      const element = sent.elements['latency-panel'];
      expect(element.kind).toBe('Panel');
      if (element.kind === 'Panel') {
        expect(element.spec.vizConfig.spec.fieldConfig.overrides).toHaveLength(1);
      }

      stopPanel();
    });

    // The assistant may have read this same recoloured look through a prior GET_NOTEBOOK_SPEC and
    // carried it into its own spec: discard has to win over that, not just over an untouched one. The
    // title change is an unrelated real edit, so the write actually happens rather than being skipped
    // as a no-op against the baseline.
    it('discards the reader’s look when told to, even if the caller’s own spec still carries it', async () => {
      const { client, stopPanel } = await sceneWithPendingChange();

      const taintedSpec = notebookSpec({ title: 'Renamed by assistant' });
      const taintedElement = taintedSpec.elements['latency-panel'];
      if (taintedElement.kind === 'Panel') {
        taintedElement.spec.vizConfig = {
          ...taintedElement.spec.vizConfig,
          spec: {
            options: {},
            fieldConfig: {
              defaults: {},
              overrides: [
                {
                  matcher: { id: 'byName', options: 'up' },
                  properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
                },
              ],
            },
          },
        };
      }

      const result = await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: { spec: taintedSpec, viewOnlyChanges: 'discard' },
      });

      expect(result.success).toBe(true);
      const [, sent] = jest.mocked(updateNotebook).mock.calls[0];
      const element = sent.elements['latency-panel'];
      expect(element.kind).toBe('Panel');
      if (element.kind === 'Panel') {
        expect(element.spec.vizConfig.spec.fieldConfig.overrides).toEqual([]);
      }

      stopPanel();
    });

    // Discard goes back to the look from before the reader's change, as the modal's discard does. That
    // is not always the saved look: an edit whose save failed is still the notebook's own.
    it('keeps an earlier edit whose save failed when discarding a later view-only change', async () => {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);
      const panel = scene.state.body.state.cells.find((c) => c.state.elementName === 'latency-panel')!.state
        .body as VizPanel;
      const stopPanel = panel.activate();

      // The writer's own edit, which the server refuses.
      scene.onEnterEditMode();
      recolour(panel, 'red');
      jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('apiserver said no'));
      scene.onExitEditMode();
      await scene.autosave.awaitPendingSave().catch(() => undefined);
      expect(updateNotebook).toHaveBeenCalledTimes(1);

      // Then a reader changes the same panel in view mode.
      recolour(panel, 'green');

      const result = await client.execute({
        type: 'APPLY_NOTEBOOK_SPEC',
        payload: { spec: notebookSpec({ title: 'Renamed by assistant' }), viewOnlyChanges: 'discard' },
      });

      expect(result.success).toBe(true);
      const [, sent] = jest.mocked(updateNotebook).mock.calls[1];
      const element = sent.elements['latency-panel'];
      expect(element.kind).toBe('Panel');
      if (element.kind === 'Panel') {
        expect(element.spec.vizConfig.spec.fieldConfig.overrides[0].properties[0].value).toEqual({
          mode: 'fixed',
          fixedColor: 'red',
        });
      }

      stopPanel();
    });
  });

  // Entering edit mode changes the mode and what autosave counts as edited, so it has to wait until the
  // replacement exists. A spec that cannot be rebuilt must leave the notebook as it was.
  describe('when the spec cannot be rebuilt', () => {
    function unbuildableSpec() {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deliberately malformed
      return { ...notebookSpec(), elements: undefined } as unknown as ReturnType<typeof notebookSpec>;
    }

    it('fails without putting the notebook into edit mode', async () => {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);
      const before = cellNamesOf(scene);
      expect(scene.state.isEditing).toBeFalsy();

      const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: unbuildableSpec() } });

      expect(result.success).toBe(false);
      expect(scene.state.isEditing).toBeFalsy();
      expect(cellNamesOf(scene)).toEqual(before);
      expect(updateNotebook).not.toHaveBeenCalled();
    });

    it('does not forget an edit whose save failed, so a retry still writes it', async () => {
      const scene = notebookScene();
      const client = new NotebookMutationClient(scene);
      const panel = scene.state.body.state.cells.find((c) => c.state.elementName === 'latency-panel')!.state
        .body as VizPanel;
      const stopPanel = panel.activate();

      scene.onEnterEditMode();
      panel.setState({
        fieldConfig: {
          defaults: {},
          overrides: [
            {
              matcher: { id: 'byName', options: 'up' },
              properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
            },
          ],
        },
      });
      jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('apiserver said no'));
      scene.onExitEditMode();
      await scene.autosave.awaitPendingSave().catch(() => undefined);

      const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: unbuildableSpec() } });
      expect(result.success).toBe(false);

      scene.autosave.retry();
      await scene.autosave.awaitPendingSave();

      const [, sent] = jest.mocked(updateNotebook).mock.calls.at(-1) ?? [];
      const element = sent?.elements['latency-panel'];
      expect(element?.kind).toBe('Panel');
      if (element?.kind === 'Panel') {
        expect(element.spec.vizConfig.spec.fieldConfig.overrides).toHaveLength(1);
      }

      stopPanel();
    });
  });
});
