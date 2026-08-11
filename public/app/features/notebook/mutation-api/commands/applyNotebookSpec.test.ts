import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

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

describe('APPLY_NOTEBOOK_SPEC', () => {
  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
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
    // The rebuild replaces the layout manager, which holds the header on its own state. A swap that
    // dropped it would render a titleless document.
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

    // 'ghost' is referenced by the layout but absent from elements. The deserializer skips it rather
    // than failing, so without the warning this write would report plain success one cell short.
    const next = notebookSpec({
      elements: { intro: markdownCell('## Intro') },
      cells: ['intro', 'ghost'],
    });

    const result = await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: next } });

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(['These cells were not applied and are missing from the notebook: ghost.']);
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
    // With the time controls hidden nothing renders the refresh picker, so NotebookScene activates it
    // itself. A rebuild-and-swap hands the scene a NEW picker, and a one-shot activation would leave
    // auto-refresh silently stopped after an assistant edit.
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
