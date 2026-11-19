import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { updateNotebook } from '../../api/notebookResource';
import { NotebookMutationClient } from '../NotebookMutationClient';
import { NOTEBOOKS_FLAG, notebookScene, notebookSpec } from '../test-utils';

// Only the network write is stubbed, so APPLY_NOTEBOOK_SPEC can drive a real save in the
// resourceVersion tests below without hitting the network.
jest.mock('../../api/notebookResource', () => ({
  ...jest.requireActual('../../api/notebookResource'),
  updateNotebook: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id }).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

// Driven through the client, which is where the permission rule and the payload schema actually run.
describe('GET_NOTEBOOK_SPEC', () => {
  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
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

    // A panel cell named 'latency-panel' must not be rekeyed to 'panel-1' on the way out, and a dangling
    // layout reference is a silently missing cell.
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

  it('carries no resourceVersion when nothing has been saved through this scene yet', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect((result.data as { resourceVersion?: string }).resourceVersion).toBeUndefined();
  });

  it('carries the resourceVersion of the last save, so a caller can conflict-check without a REST read', async () => {
    jest.mocked(updateNotebook).mockResolvedValue({ generation: 2, resourceVersion: '1756' });
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);
    await client.execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec: notebookSpec({ title: 'Renamed' }) } });

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect((result.data as { resourceVersion?: string }).resourceVersion).toBe('1756');
  });

  it('is refused when notebooks are not enabled', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect(result.success).toBe(false);
    expect(result.error).toContain('dashboard.notebooks');
  });

  it('is refused when the user does not have permission to read notebooks', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot read notebook: insufficient permissions.');
  });

  it('reports no pendingViewOnlyChanges when the reader has not touched a panel', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect((result.data as { pendingViewOnlyChanges?: string[] }).pendingViewOnlyChanges).toBeUndefined();
  });

  it('names a panel the reader recoloured without saving it', async () => {
    const scene = notebookScene();
    const client = new NotebookMutationClient(scene);
    const cell = scene.state.body.state.cells.find((c) => c.state.elementName === 'latency-panel');
    const panel = cell!.state.body as VizPanel;
    const stopPanel = panel.activate();

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

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect((result.data as { pendingViewOnlyChanges?: string[] }).pendingViewOnlyChanges).toEqual(['latency-panel']);

    stopPanel();
  });
});
