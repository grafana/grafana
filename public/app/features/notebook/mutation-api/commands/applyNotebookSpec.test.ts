import { SceneObjectBase } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { notebookResourceFor, updateNotebook } from '../../api/notebookResource';
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

  it('leaves the rebuilt body out of edit mode when the notebook was not being edited', async () => {
    const scene = notebookScene();
    expect(scene.state.isEditing).toBeFalsy();

    const client = new NotebookMutationClient(scene);
    await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { only: markdownCell('## After') }, cells: ['only'] }) },
    });

    expect(scene.state.body.state.isEditing).toBe(false);
  });

  it('saves the applied change, which the scene change signal would otherwise miss', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);

    const result = await client.execute({
      type: 'APPLY_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { summary: markdownCell('## Resolved') }, cells: ['summary'] }) },
    });

    expect(result.success).toBe(true);
    // The notebook was never in edit mode, so the scene's own change signal is ignored for this write.
    expect(scene.state.isEditing).toBeFalsy();
    // Asserted on the request, not on a call to autosave, so what was sent is what the caller asked for.
    expect(updateNotebook).toHaveBeenCalledTimes(1);
    const [, sent] = jest.mocked(updateNotebook).mock.calls[0];
    expect(sent.layout.spec.cells.map((cell) => cell.spec.element.name)).toEqual(['summary']);
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
});
