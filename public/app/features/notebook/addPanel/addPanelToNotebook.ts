import { t } from '@grafana/i18n';

import { NotebookAnalytics } from '../analytics/main';
import {
  NOTEBOOK_ADD_FAILED_REASON,
  NOTEBOOK_EDIT_SESSION_SOURCE,
  type NotebookAddFailedReason,
  type NotebookEntryPoint,
} from '../analytics/types';
import { createNotebook, NotebookConflictError, updateNotebookSpec } from '../api/notebookResource';
import { type NotebookScene } from '../scene/NotebookScene';
import { findActiveNotebookScene } from '../scene/activeNotebookScenes';
import { defaultSpec as defaultNotebookSpec, type PanelElement, type Spec as NotebookSpec } from '../types';

import {
  appendElementsToNotebook,
  appendPanelToNotebook,
  type AppendedCellSource,
  type AppendedElement,
} from './appendPanelToNotebook';

/** Enough to build the success toast and its link. */
export interface AddedToNotebook {
  uid: string;
  title: string;
}

interface CreateNotebookFields {
  title: string;
}

/** The open notebook moved on under its own scene, so retrying from here would conflict again. */
export class OpenNotebookConflictError extends NotebookConflictError {}

interface Appended {
  spec: NotebookSpec;
  firstPosition: number;
}

/**
 * A notebook that is open somewhere gets the cells through its scene, so the view updates and its
 * autosave keeps the right version. Otherwise it is a read-modify-write through api/notebookResource.
 */
async function appendToExistingNotebook(
  uid: string,
  cells: AppendedElement[],
  source: AppendedCellSource
): Promise<Appended> {
  const scene = findActiveNotebookScene(uid);
  if (scene) {
    return appendThroughScene(scene, cells, source);
  }

  let firstPosition = 0;
  const spec = await updateNotebookSpec(uid, (current) => {
    firstPosition = current.layout.spec.cells.length;
    return appendElementsToNotebook(current, cells, source);
  });
  return { spec, firstPosition };
}

async function appendThroughScene(
  scene: NotebookScene,
  cells: AppendedElement[],
  source: AppendedCellSource
): Promise<Appended> {
  // Lazy so a dashboard or Explore caller with no notebook open never loads the scene write path.
  const { guardNotebookSceneWrite, writeNotebookSpecToScene } = await import(
    '../mutation-api/commands/applyNotebookSpec'
  );

  const refused = await guardNotebookSceneWrite(scene, { viewOnlyChanges: 'keep' });
  if (refused) {
    throw hasFlag(refused.data, 'conflict') ? new OpenNotebookConflictError() : new Error(refused.error);
  }

  let appended: Appended | undefined;
  const result = await writeNotebookSpecToScene(
    scene,
    // Built from the scene at swap time, so concurrent edits and adds are kept.
    (current) => {
      const spec = appendElementsToNotebook(current, cells, source);
      appended = { spec, firstPosition: current.layout.spec.cells.length };
      return spec;
    },
    {
      viewOnlyChanges: 'keep',
      undoLabel: t('notebooks.add-panel.undo-label', 'Add to notebook'),
      editSessionSource: NOTEBOOK_EDIT_SESSION_SOURCE.ADD_TO_NOTEBOOK,
    }
  );
  // Applied but not saved: the cells are on screen and the notebook's own "Save failed" + Retry owns
  // the save. Throwing would keep the form open, and adding again would duplicate them.
  if (!result.success && !hasFlag(result.data, 'applied')) {
    throw new Error(result.error);
  }
  if (!appended) {
    throw new Error(result.error ?? 'The notebook could not be updated.');
  }

  return appended;
}

function hasFlag(data: unknown, flag: 'conflict' | 'applied'): boolean {
  return typeof data === 'object' && data !== null && flag in data && Reflect.get(data, flag) === true;
}

export async function addPanelToExistingNotebook(
  uid: string,
  panel: PanelElement,
  entryPoint: NotebookEntryPoint,
  isLibraryPanel: boolean
): Promise<AddedToNotebook> {
  const { spec, firstPosition } = await appendToExistingNotebook(uid, [{ kind: 'panel', panel }], 'user');

  // Reported here, not in the layout manager, which only reports cells added from inside the notebook.
  NotebookAnalytics.cellAddedFromAddToNotebook(uid, entryPoint, firstPosition, {
    panel,
    isLibraryPanel,
  });

  return { uid, title: spec.title };
}

export async function createNotebookWithPanel(
  fields: CreateNotebookFields,
  panel: PanelElement,
  entryPoint: NotebookEntryPoint,
  isLibraryPanel: boolean
): Promise<AddedToNotebook> {
  const spec = appendPanelToNotebook({ ...defaultNotebookSpec(), title: fields.title }, panel);

  const created = await createNotebook(spec);
  NotebookAnalytics.created(created.uid, entryPoint, spec.layout.spec.cells.length, { panel, isLibraryPanel });

  return { uid: created.uid, title: spec.title };
}

/** Several cells in one write, e.g. a chat answer with its panels. */
export async function addCellsToExistingNotebook(
  uid: string,
  cells: AppendedElement[],
  entryPoint: NotebookEntryPoint,
  source: AppendedCellSource
): Promise<AddedToNotebook> {
  const { spec, firstPosition } = await appendToExistingNotebook(uid, cells, source);

  cells.forEach((cell, index) => {
    if (cell.kind === 'panel') {
      NotebookAnalytics.cellAddedFromAddToNotebook(uid, entryPoint, firstPosition + index, {
        panel: cell.panel,
        isLibraryPanel: false,
      });
    }
  });

  return { uid, title: spec.title };
}

export async function createNotebookWithCells(
  fields: CreateNotebookFields,
  cells: AppendedElement[],
  entryPoint: NotebookEntryPoint,
  source: AppendedCellSource
): Promise<AddedToNotebook> {
  const spec = appendElementsToNotebook({ ...defaultNotebookSpec(), title: fields.title }, cells, source);

  const created = await createNotebook(spec);
  NotebookAnalytics.created(created.uid, entryPoint, spec.layout.spec.cells.length);

  return { uid: created.uid, title: spec.title };
}

/**
 * Why the attempt failed, for the failure event.
 *
 * A panel that would not serialize and a request that came back 400 both arrive as plain Errors. So
 * the caller has to say whether the panel was built.
 */
export function addPanelFailureReason(error: unknown, panelWasBuilt: boolean): NotebookAddFailedReason {
  if (!panelWasBuilt) {
    return NOTEBOOK_ADD_FAILED_REASON.BUILD_FAILED;
  }

  if (error instanceof NotebookConflictError) {
    return NOTEBOOK_ADD_FAILED_REASON.CONFLICT;
  }

  return NOTEBOOK_ADD_FAILED_REASON.WRITE_FAILED;
}

/**
 * A conflict is the one failure the user can do something about, so it gets its own wording rather
 * than the generic message. Everything else surfaces the apiserver's own message, which the resource
 * module has already extracted — a caller that sees only "something went wrong" retries the same spec.
 */
export function addPanelErrorMessage(error: unknown): string {
  if (error instanceof OpenNotebookConflictError) {
    return t(
      'notebooks.add-panel.error-open-conflict',
      'This notebook changed since it was opened. Reload it and try again.'
    );
  }

  if (error instanceof NotebookConflictError) {
    return t(
      'notebooks.add-panel.error-conflict',
      'This notebook changed while you were adding to it. Try again to add the panel to the latest version.'
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t('notebooks.add-panel.error-generic', 'Failed to add the panel to the notebook');
}
