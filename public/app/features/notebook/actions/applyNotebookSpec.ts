import { t } from '@grafana/i18n';
import { getPanelPluginMetasMap } from '@grafana/runtime/internal';
import { sceneUtils } from '@grafana/scenes';

import { NOTEBOOK_EDIT_SESSION_SOURCE } from '../analytics/types';
import { notebookResourceFor } from '../api/notebookResource';
import { NOTEBOOK_EDIT_KIND } from '../scene/NotebookEditHistory';
import { type NotebookScene } from '../scene/NotebookScene';
import { isEmptyMarkdown } from '../scene/layout-notebook/cellEmptiness';
import { validateNotebookSpec } from '../schema/notebookSpecSchema';
import { type Spec as NotebookSpec } from '../types';

const UNKNOWN_SURVIVORS_WARNING =
  'The notebook could not be checked after the write, so it is unknown which cells survived it.';

export interface ApplyNotebookSpecOptions<Refusal> {
  /** Validate the spec against the notebook schema first, and refuse it when invalid. */
  validate: boolean;
  /**
   * What to do with panel looks the person reading changed and nobody has decided about. Without it, a
   * notebook with such changes is refused untouched, so the caller can ask first.
   */
  viewOnlyChanges?: 'keep' | 'discard';
  /**
   * The caller already refused a notebook with unresolved view-only changes, before awaiting anything of
   * its own (the mutation API checks before its conflict read), so they are not checked again here.
   */
  viewOnlyChangesChecked?: boolean;
  /**
   * Checked synchronously after everything awaited, immediately before the swap: nothing can change the
   * notebook between it and the write. A refusal leaves the notebook untouched.
   */
  gate?: () => Refusal | undefined;
  /**
   * Whether the write enters edit mode first, as the mutation API's writes do. Composer leaves it off: it
   * is a mode of its own, and its writes are held back from saving until it ends.
   */
  enterEditMode: boolean;
}

export type ApplyNotebookSpecResult<Refusal> =
  | { status: 'applied'; spec?: NotebookSpec; warnings: string[] }
  /** Panel looks a reader changed and the caller did not resolve. */
  | { status: 'view_only_changes'; elements: string[] }
  | { status: 'invalid'; error: string }
  | { status: 'refused'; refusal: Refusal };

/**
 * Replaces the notebook with `rawSpec`, as one step on its edit history (native undo reverts it whole).
 * Saving is the caller's: the mutation API saves at once, Composer when its session ends.
 *
 * Three phases, so a caller can check the notebook it is about to overwrite at the last moment:
 * 1. prepare: validate, resolve view-only changes and rebuild the scene from the spec, awaiting what it must;
 * 2. gate: the caller's `gate`, synchronously, with nothing awaited after it;
 * 3. swap: the new scene state goes in through the edit history.
 */
export async function applyNotebookSpec<Refusal = never>(
  scene: NotebookScene,
  rawSpec: unknown,
  { validate, viewOnlyChanges, viewOnlyChangesChecked = false, gate, enterEditMode }: ApplyNotebookSpecOptions<Refusal>
): Promise<ApplyNotebookSpecResult<Refusal>> {
  // 1. Prepare. Checked first and before anything else touches the scene: a caller that has not yet asked
  // the person reading what to do with their changes gets nothing done, rather than a half-applied write it
  // would then have to explain.
  const pendingViewOnlyChanges = viewOnlyChangesChecked ? [] : scene.autosave.viewOnlyVizChanges();
  if (pendingViewOnlyChanges.length > 0 && !viewOnlyChanges) {
    return { status: 'view_only_changes', elements: pendingViewOnlyChanges };
  }

  const warnings: string[] = [];
  let notebookSpec: NotebookSpec;
  if (validate) {
    const result = validateNotebookSpec(rawSpec);
    if (!result.success || !result.data) {
      return { status: 'invalid', error: `Validation failed: ${result.errors.join(', ')}` };
    }
    warnings.push(...result.warnings);
    notebookSpec = result.data;
  } else {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
    notebookSpec = rawSpec as NotebookSpec;
  }

  if (viewOnlyChanges) {
    const resolved = scene.autosave.resolveViewOnlyVizChanges(viewOnlyChanges);
    if (resolved.size > 0) {
      const elements = { ...notebookSpec.elements };
      for (const [name, vizConfig] of resolved) {
        const element = elements[name];
        if (element?.kind === 'Panel') {
          elements[name] = { ...element, spec: { ...element.spec, vizConfig } };
        }
      }
      notebookSpec = { ...notebookSpec, elements };
    }
  }

  // Both are loaded before the scene changes, so a failed import cannot leave it changed but unsaved.
  const [{ transformNotebookToScene }, { transformNotebookSceneToSaveModel }] = await Promise.all([
    import(/* webpackChunkName: "notebook-serialization" */ '../serialization/transformNotebookToScene'),
    import(/* webpackChunkName: "notebook-serialization" */ '../serialization/transformNotebookSceneToSaveModel'),
  ]);

  // Panel cells in the incoming spec are built synchronously by the transform below.
  await getPanelPluginMetasMap();

  const rebuilt = transformNotebookToScene(notebookResourceFor(scene.state.uid, notebookSpec));

  // 2. Gate, synchronously: nothing below this line awaits, so nothing can run between the checks and the
  // write.
  const refusal = gate?.();
  if (refusal !== undefined) {
    return { status: 'refused', refusal };
  }

  // 3. Swap. Only once the replacement exists: entering edit mode changes the mode and what autosave counts
  // as edited, which a spec that fails to rebuild must not leave behind.
  if (enterEditMode) {
    scene.enterEditModeForDocumentWrite(NOTEBOOK_EDIT_SESSION_SOURCE.ASSISTANT);
  }

  // Closes out any cell or title edit still coalescing, so it lands as its own undo step under this one
  // instead of being folded into (or lost under) the whole-document swap.
  scene.state.body.commitPendingEdits();
  scene.commitTitleEdit();

  const previousState = scene.state;
  const newState = {
    ...sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key }),
    overlay: undefined,
  };

  scene.editHistory.execute({
    label: t('notebook.mutation-api.apply-spec.undo-label', 'Assistant edit'),
    // Known simplification: a whole-spec apply can add, remove and move several cells at once, which EDIT
    // doesn't really mean ("a cell that was already there, changed"). Attributing it correctly needs a
    // before/after cell diff to tell an actual add/remove/move apart from a cell that only shifted because a
    // neighbor was added or removed — left for a follow-up rather than done here. For now this just
    // undercounts cellsAdded/cellsRemoved/cellsMoved for an assistant-written session; editCount itself is
    // still right.
    kind: NOTEBOOK_EDIT_KIND.EDIT,
    // The mode is the scene's at the time, not the document's: undoing a Composer edit later, in edit mode,
    // must not reopen Composer or leave editing.
    perform: () => scene.setState({ ...newState, ...currentMode(scene) }),
    undo: () => scene.setState({ ...previousState, ...currentMode(scene) }),
  });

  let appliedNotebook: NotebookSpec | undefined;
  try {
    appliedNotebook = transformNotebookSceneToSaveModel(scene);
    warnings.push(...droppedCellWarnings(notebookSpec, appliedNotebook));
  } catch {
    warnings.push(UNKNOWN_SURVIVORS_WARNING);
  }

  return { status: 'applied', spec: appliedNotebook, warnings };
}

function currentMode(scene: NotebookScene) {
  const { uid, isEditing, isComposing } = scene.state;
  return { uid, isEditing, isComposing };
}

function droppedCellWarnings(requested: NotebookSpec, applied: NotebookSpec): string[] {
  const survived = new Set(applied.layout.spec.cells.map((cell) => cell.spec.element.name));
  const dropped = [...new Set(requestedCellNames(requested))].filter((name) => !survived.has(name));

  return dropped.length > 0
    ? [`These cells were not applied and are missing from the notebook: ${dropped.join(', ')}.`]
    : [];
}

// The trailing empty block is excluded because the save model leaves it out too (see
// NotebookLayoutManager.contentCells), so counting it would report a cell as lost when none was.
// `cells` is guarded because the spec comes from the caller, and Go marshals an empty slice as null.
function requestedCellNames(spec: NotebookSpec): string[] {
  const cells = spec.layout.spec.cells ?? [];
  const last = cells[cells.length - 1];
  const lastElement = last ? spec.elements?.[last.spec.element.name] : undefined;
  const endsWithEmptyBlock = lastElement?.kind === 'Cell' && isEmptyMarkdown(lastElement.spec.content);

  return (endsWithEmptyBlock ? cells.slice(0, -1) : cells).map((cell) => cell.spec.element.name);
}
