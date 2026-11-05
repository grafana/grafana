import { assignNotebookCellIds } from '../api/notebookResource';
import { canEditNotebooks } from '../permissions';

import { type NotebookScene } from './NotebookScene';

const attempted = new WeakSet<NotebookScene>();

/**
 * Gives the cells of a notebook that predates ids their ids, by writing it back once as it is stored.
 *
 * The server assigns an id to every cell that arrives without one, so the write carries no change of
 * the user's. It happens on open rather than on the first edit so a notebook nobody edits still has ids
 * by the time someone wants to comment on it.
 *
 * Only someone allowed to write does it, and once per scene, so a server that does not return ids is
 * not asked again on every activation. It sends the stored notebook rather than the scene (see
 * `assignNotebookCellIds`), and it is not a save: nobody asked for it, so nothing is shown when it
 * fails or conflicts. The other writer's save has already given the cells ids, or the next open tries
 * again.
 */
export async function migrateNotebookCellIds(scene: NotebookScene): Promise<void> {
  const { uid } = scene.state;
  if (!uid || attempted.has(scene) || !canEditNotebooks() || !scene.autosave.canAdoptIds()) {
    return;
  }

  // A save of the scene's own would give the cells their ids itself.
  if (scene.state.body.contentCells().every((cell) => cell.state.id)) {
    return;
  }
  attempted.add(scene);

  try {
    const { cells, generation, resourceVersion } = await assignNotebookCellIds(uid);
    scene.autosave.adoptStoredCells(cells, { generation, resourceVersion });
  } catch {
    // Nothing of the user's was in the write, so nothing is lost and nothing is reported.
  }
}
