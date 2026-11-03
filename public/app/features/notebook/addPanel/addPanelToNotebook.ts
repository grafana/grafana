import { t } from '@grafana/i18n';
import { getPanelPluginMetasMap } from '@grafana/runtime/internal';

import { NotebookAnalytics } from '../analytics/main';
import {
  NOTEBOOK_ADD_FAILED_REASON,
  NOTEBOOK_EDIT_SESSION_SOURCE,
  type NotebookAddFailedReason,
  type NotebookEntryPoint,
} from '../analytics/types';
import {
  createNotebook,
  NotebookConflictError,
  notebookResourceFor,
  updateNotebookSpec,
} from '../api/notebookResource';
import { type NotebookScene } from '../scene/NotebookScene';
import { findActiveNotebookScene } from '../scene/sceneContextStack';
import { defaultSpec as defaultNotebookSpec, type NotebookElement, type Spec as NotebookSpec } from '../types';

import { appendElementsToNotebook, type AppendedCellSource, type AppendedElement } from './appendPanelToNotebook';

/** Enough to build the success toast and its link. */
export interface AddedToNotebook {
  uid: string;
  title: string;
}

interface CreateNotebookFields {
  title: string;
}

const RESERVED_ELEMENT: NotebookElement = {
  kind: 'Cell',
  spec: { content: { kind: 'Markdown', spec: { text: '' } } },
};

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
    const appended = await appendThroughScene(scene, cells, source);
    if (appended) {
      return appended;
    }
    // Its teardown flushed any pending edits; let that save land first, or the two writes would conflict.
    await scene.autosave.awaitInFlightSave();
  }

  let firstPosition = 0;
  const spec = await updateNotebookSpec(uid, (current) => {
    firstPosition = current.layout.spec.cells.length;
    return appendElementsToNotebook(current, cells, source);
  });
  return { spec, firstPosition };
}

/** Undefined when the scene stopped being shown while the add was loading; nothing is changed then. */
async function appendThroughScene(
  scene: NotebookScene,
  cells: AppendedElement[],
  source: AppendedCellSource
): Promise<Appended | undefined> {
  // Lazy so a dashboard or Explore caller with no notebook open never loads the scene write path.
  const [{ transformNotebookToScene }, { transformNotebookSceneToSaveModel }] = await Promise.all([
    import('../serialization/transformNotebookToScene'),
    import('../serialization/transformNotebookSceneToSaveModel'),
  ]);

  const savedElsewhere = await scene.autosave.isSavedElsewhere();

  // The transform below builds panel cells synchronously.
  await getPanelPluginMetasMap();

  // Its autosave stops when it deactivates, so cells inserted now would never be saved. Checked before
  // the conflict, which only matters to a scene that is still showing.
  if (!scene.isActive) {
    return undefined;
  }
  if (savedElsewhere) {
    throw new OpenNotebookConflictError();
  }

  // No await from here on, so an edit or another add that landed during the loads is built on. The new
  // cells are built by the same transform as a saved notebook and inserted as copies; everything else in
  // the scene, including a reader's own time ranges and panel tweaks, is left exactly as it is.
  const current = transformNotebookSceneToSaveModel(scene);
  // The save model leaves out the trailing empty block, whose name the scene still holds; reserve it so
  // a new cell can't take it. The placeholder is unreferenced, so the transform ignores it.
  const elements = { ...current.elements };
  for (const cell of scene.state.body.state.cells) {
    if (!Object.hasOwn(elements, cell.state.elementName)) {
      elements[cell.state.elementName] = RESERVED_ELEMENT;
    }
  }
  const spec = appendElementsToNotebook({ ...current, elements }, cells, source);
  const built = transformNotebookToScene(notebookResourceFor(scene.state.uid, spec))
    .state.body.state.cells.slice(current.layout.spec.cells.length, current.layout.spec.cells.length + cells.length)
    .map((cell) => cell.clone());

  scene.enterEditModeForDocumentWrite(NOTEBOOK_EDIT_SESSION_SOURCE.ADD_TO_NOTEBOOK);
  const firstPosition = scene.state.body.appendCells(built, t('notebooks.add-panel.undo-label', 'Add to notebook'));
  // Autosave writes it as any edit, which keeps view-only state out of the save; flushed so it goes now.
  scene.autosave.flush();

  return { spec, firstPosition };
}

/**
 * Adds cells in one write, e.g. a single panel or a chat answer with its panels.
 *
 * `lockTimeRange` is what the person chose in the modal, passed on for the events and nothing else:
 * the cells already carry whatever it did to them.
 */
export async function addToExistingNotebook(
  uid: string,
  cells: AppendedElement[],
  entryPoint: NotebookEntryPoint,
  source: AppendedCellSource = 'user',
  lockTimeRange = false
): Promise<AddedToNotebook> {
  const { spec, firstPosition } = await appendToExistingNotebook(uid, cells, source);

  // Reported here, not in the layout manager, which only reports cells added from inside the notebook.
  // Markdown too: a chat answer sends its text alongside its panels.
  cells.forEach((cell, index) => {
    NotebookAnalytics.cellAddedFromAddToNotebook(
      uid,
      entryPoint,
      firstPosition + index,
      cell.kind === 'panel' ? addedPanel(cell) : undefined,
      lockTimeRange
    );
  });

  return { uid, title: spec.title };
}

export async function createNotebookWithContent(
  fields: CreateNotebookFields,
  cells: AppendedElement[],
  entryPoint: NotebookEntryPoint,
  source: AppendedCellSource = 'user',
  lockTimeRange = false
): Promise<AddedToNotebook> {
  const spec = appendElementsToNotebook({ ...defaultNotebookSpec(), title: fields.title }, cells, source);

  const created = await createNotebook(spec);
  // The created event describes a panel only when there is exactly one to describe.
  const panels = cells.filter((cell): cell is PanelCell => cell.kind === 'panel');
  NotebookAnalytics.created(
    created.uid,
    entryPoint,
    spec.layout.spec.cells.length,
    panels.length === 1 ? addedPanel(panels[0]) : undefined,
    lockTimeRange
  );

  return { uid: created.uid, title: spec.title };
}

type PanelCell = Extract<AppendedElement, { kind: 'panel' }>;

function addedPanel(cell: PanelCell) {
  return { panel: cell.panel, isLibraryPanel: cell.isLibraryPanel ?? false };
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
