import { contextSrv } from 'app/core/services/context_srv';

import { assignNotebookCellIds, NotebookConflictError } from '../api/notebookResource';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';
import { defaultSpec as defaultNotebookSpec } from '../types';

import { migrateNotebookCellIds } from './migrateNotebookCellIds';

jest.mock('../api/notebookResource', () => ({
  assignNotebookCellIds: jest.fn(),
  NotebookConflictError: class NotebookConflictError extends Error {},
  createNotebook: jest.fn(),
  updateNotebook: jest.fn(),
  readNotebookResourceVersion: jest.fn(),
}));

const ID = '00000000-0000-4000-8000-0000000000a0';

/** A notebook saved before ids existed, as a load would build it. */
function sceneWithoutIds(cellId?: string) {
  return transformNotebookToScene({
    apiVersion: 'notebook.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb-1', resourceVersion: '1', generation: 1, creationTimestamp: '2026-07-01T00:00:00Z' },
    spec: {
      ...defaultNotebookSpec(),
      title: 'My notebook',
      elements: { md1: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Hi' } } } } },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: {
                element: { kind: 'ElementReference', name: 'md1' },
                source: 'user',
                ...(cellId ? { id: cellId } : {}),
              },
            },
          ],
        },
      },
    },
  });
}

describe('migrateNotebookCellIds', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    jest
      .mocked(assignNotebookCellIds)
      .mockReset()
      .mockResolvedValue({ generation: 2, resourceVersion: '2', cells: [{ element: 'md1', id: ID }] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes the stored notebook back and hands the ids to autosave', async () => {
    const scene = sceneWithoutIds();

    await migrateNotebookCellIds(scene);

    expect(assignNotebookCellIds).toHaveBeenCalledWith('nb-1');
    expect(scene.state.body.state.cells[0].state.id).toBe(ID);
    expect(scene.autosave.state.savedResourceVersion).toBe('2');
  });

  it('asks once per scene', async () => {
    const scene = sceneWithoutIds();

    await migrateNotebookCellIds(scene);
    await migrateNotebookCellIds(scene);

    expect(assignNotebookCellIds).toHaveBeenCalledTimes(1);
  });

  it('leaves a notebook whose cells all have ids alone', async () => {
    await migrateNotebookCellIds(sceneWithoutIds(ID));

    expect(assignNotebookCellIds).not.toHaveBeenCalled();
  });

  it('leaves it alone for someone who cannot write', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    await migrateNotebookCellIds(sceneWithoutIds());

    expect(assignNotebookCellIds).not.toHaveBeenCalled();
  });

  it('leaves a scene that autosave was abandoned for alone, as the PDF render does', async () => {
    const scene = sceneWithoutIds();
    scene.autosave.abandon();

    await migrateNotebookCellIds(scene);

    expect(assignNotebookCellIds).not.toHaveBeenCalled();
  });

  it('says nothing when someone else saved first, and does not touch the scene', async () => {
    jest.mocked(assignNotebookCellIds).mockRejectedValue(new NotebookConflictError('conflict'));
    const scene = sceneWithoutIds();

    await expect(migrateNotebookCellIds(scene)).resolves.toBeUndefined();

    expect(scene.state.body.state.cells[0].state.id).toBeUndefined();
    expect(scene.autosave.state.status).not.toBe('error');
  });

  it('does not show any save status while it works', async () => {
    const scene = sceneWithoutIds();
    const statuses: string[] = [];
    scene.autosave.subscribeToState({ next: (state) => statuses.push(state.status) });

    await migrateNotebookCellIds(scene);

    expect(statuses.every((status) => status === 'idle')).toBe(true);
  });
});
