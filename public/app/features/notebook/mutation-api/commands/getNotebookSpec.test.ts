import { setTestFlags } from '@grafana/test-utils/unstable';

import { NotebookMutationClient } from '../NotebookMutationClient';
import { NOTEBOOKS_FLAG, notebookScene, notebookSpec } from '../test-utils';

// Driven through the client rather than by calling the handler, because the client is where the
// permission rule and the payload schema actually run.
describe('GET_NOTEBOOK_SPEC', () => {
  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('returns the whole notebook, narrative cells included', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect(result.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing the command's own result shape
    const spec = (result.data as { spec: ReturnType<typeof notebookSpec> }).spec;

    expect(Object.keys(spec.elements).sort()).toEqual(['intro', 'latency-panel', 'query']);
    expect(spec.elements.intro).toEqual({
      kind: 'Cell',
      spec: { content: { kind: 'Markdown', spec: { text: '## Checkout latency spike' } } },
    });
    expect(spec.elements.query).toEqual({
      kind: 'Cell',
      spec: { content: { kind: 'Code', spec: { language: 'promql', code: 'up == 0' } } },
    });
  });

  it('round-trips the spec it was built from', async () => {
    const spec = notebookSpec();
    const client = new NotebookMutationClient(notebookScene(spec));

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect(result.data).toEqual({ spec });
  });

  it('keeps element names that are not panel-<id>, and the layout keeps referencing them', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing the command's own result shape
    const spec = (result.data as { spec: ReturnType<typeof notebookSpec> }).spec;

    // A panel cell named 'latency-panel' must not be rekeyed to 'panel-1' on the way out, and every
    // layout reference must resolve — a dangling reference is a silently missing cell.
    expect(spec.elements['latency-panel']).toBeDefined();
    const referenced = spec.layout.spec.cells.map((cell) => cell.spec.element.name);
    expect(referenced).toEqual(['intro', 'latency-panel', 'query']);
    for (const name of referenced) {
      expect(spec.elements[name]).toBeDefined();
    }
  });

  it('passes validation when asked to validate', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: { validate: true } });

    expect(result).toMatchObject({ success: true });
  });

  it('rejects an unknown payload field', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: { validat: true } });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('is refused when notebooks are not enabled', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect(result.success).toBe(false);
    expect(result.error).toContain('dashboard.notebooks');
  });
});
