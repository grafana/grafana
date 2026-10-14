import * as z from 'zod';

import { t } from '@grafana/i18n';
import { getPanelPluginMetasMap } from '@grafana/runtime/internal';
import { sceneUtils } from '@grafana/scenes';
import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';
import type { MutationResult } from 'app/features/dashboard-scene/mutation-api/types';

import { NOTEBOOK_EDIT_SESSION_SOURCE, type NotebookEditSessionSource } from '../../analytics/types';
import { notebookResourceFor, readNotebookResourceVersion } from '../../api/notebookResource';
import { NOTEBOOK_EDIT_KIND } from '../../scene/NotebookEditHistory';
import { type NotebookScene } from '../../scene/NotebookScene';
import { isEmptyMarkdown } from '../../scene/layout-notebook/cellEmptiness';
import { validateNotebookSpec } from '../../schema/notebookSpecSchema';
import { transformNotebookSceneToSaveModel } from '../../serialization/transformNotebookSceneToSaveModel';
import { type Spec as NotebookSpec } from '../../types';

import { requiresNotebookEdit } from './permissions';

const UNKNOWN_SURVIVORS_WARNING =
  'The notebook could not be checked after the write, so it is unknown which cells survived it.';

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

const applyNotebookSpecPayloadSchema = z
  .object({
    spec: z
      .record(z.string(), z.unknown())
      .describe('A complete notebook spec to apply (the same shape GET_NOTEBOOK_SPEC returns).'),
    validate: z
      .boolean()
      .optional()
      .default(false)
      .describe('When true, validate the spec against the notebook schema and reject the mutation if it is invalid.'),
    viewOnlyChanges: z
      .enum(['keep', 'discard'])
      .optional()
      .describe(
        'Required when GET_NOTEBOOK_SPEC reported pendingViewOnlyChanges for this notebook: ask the ' +
          'person reading whether to keep or discard their unsaved panel changes, then pass their answer ' +
          'here. Rejected with no effect on the notebook when changes are pending and this is omitted.'
      ),
    onConflict: z
      .enum(['overwrite'])
      .optional()
      .describe(
        'Set to "overwrite" only after the error said someone else saved this notebook first and the ' +
          'person chose to replace their version with this spec. Omit it otherwise: a conflict is then ' +
          'reported as an error and nothing is changed.'
      ),
  })
  .strict();

export type ApplyNotebookSpecPayload = z.infer<typeof applyNotebookSpecPayloadSchema>;

export interface NotebookSceneWriteOptions {
  viewOnlyChanges?: 'keep' | 'discard';
  onConflict?: 'overwrite';
}

/**
 * Refuses a write before it touches the scene: unsaved view-only changes nobody decided on, or a save
 * someone else made since the scene loaded. Undefined means the write may go ahead.
 */
export async function guardNotebookSceneWrite(
  scene: NotebookScene,
  options: NotebookSceneWriteOptions
): Promise<MutationResult | undefined> {
  // Checked first and before anything else touches the scene: a caller that has not yet asked the
  // person reading what to do with their changes gets nothing done, rather than a half-applied write
  // it would then have to explain.
  const pendingViewOnlyChanges = scene.autosave.viewOnlyVizChanges();
  if (pendingViewOnlyChanges.length > 0 && !options.viewOnlyChanges) {
    return {
      success: false,
      error:
        `This notebook has unsaved view-only changes to: ${pendingViewOnlyChanges.join(', ')}. Ask ` +
        'the person reading whether to keep or discard them, then retry with viewOnlyChanges set to ' +
        '"keep" or "discard".',
      changes: [],
    };
  }

  // Same shape as the check above, and for the same reason: whoever asked for this write is in a
  // conversation and chooses there, so it is refused before the scene is touched rather than
  // raising the overwrite modal afterwards over a change that is already on screen.
  if (
    scene.state.uid &&
    scene.autosave.state.savedResourceVersion !== undefined &&
    options.onConflict !== 'overwrite'
  ) {
    // Let a save of this scene's own that is already running land first. Otherwise the server can
    // already hold a version this scene wrote but has not yet recorded, which would read as someone
    // else's save. Only one already running: bringing a waiting edit forward could conflict and raise
    // the overwrite modal for it while this check is about to ask the person in the chat.
    await scene.autosave.awaitInFlightSave();
    const serverVersion = await readNotebookResourceVersion(scene.state.uid);
    // Read after the request, not before: a save that finished during it moved both versions.
    const savedVersion = scene.autosave.state.savedResourceVersion;
    if (serverVersion !== undefined && savedVersion !== undefined && serverVersion !== savedVersion) {
      return {
        success: false,
        error:
          'Someone else saved this notebook after it was opened, so nothing was changed. Ask the person ' +
          'whether to overwrite the other version with this change. If they agree, retry with onConflict ' +
          'set to "overwrite". If not, do not retry: tell them the change was not saved.',
        // The marker callers act on, so none of them has to recognise the wording of `error`.
        data: { applied: false, conflict: true },
        changes: [],
      };
    }
  }

  return undefined;
}

/** Replaces the scene's document with a spec, or with what an updater makes of the current one, as one undoable edit, then saves it. */
export async function writeNotebookSpecToScene(
  scene: NotebookScene,
  inputSpec: NotebookSpec | ((current: NotebookSpec) => NotebookSpec),
  options: NotebookSceneWriteOptions & {
    undoLabel: string;
    editSessionSource: NotebookEditSessionSource;
    warnings?: string[];
  }
): Promise<MutationResult> {
  const warnings = [...(options.warnings ?? [])];

  const { transformNotebookToScene } = await import(
    /* webpackChunkName: "notebook-serialization" */ '../../serialization/transformNotebookToScene'
  );

  // Panel cells in the incoming spec are built synchronously by the transform below.
  await getPanelPluginMetasMap();

  // No await from here to the swap: an updater reads the scene as it is now, so an edit or another
  // write that landed during the loads above is built on rather than overwritten.
  let notebookSpec = typeof inputSpec === 'function' ? inputSpec(transformNotebookSceneToSaveModel(scene)) : inputSpec;
  if (options.viewOnlyChanges) {
    const resolved = scene.autosave.resolveViewOnlyVizChanges(options.viewOnlyChanges);
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

  const rebuilt = transformNotebookToScene(notebookResourceFor(scene.state.uid, notebookSpec));

  // Only once the replacement exists: entering edit mode changes the mode and what autosave counts as
  // edited, which a spec that fails to rebuild must not leave behind.
  scene.enterEditModeForDocumentWrite(options.editSessionSource);

  // Closes out any cell or title edit still coalescing, so it lands as its own undo step under
  // this one instead of being folded into (or lost under) the whole-document swap.
  scene.state.body.commitPendingEdits();
  scene.commitTitleEdit();

  const previousState = scene.state;
  const newState = {
    ...sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key }),
    overlay: undefined,
  };

  scene.editHistory.execute({
    label: options.undoLabel,
    // Known simplification: a whole-spec apply can add, remove and move several cells at once,
    // which EDIT doesn't really mean ("a cell that was already there, changed"). Attributing it
    // correctly needs a before/after cell diff to tell an actual add/remove/move apart from a
    // cell that only shifted because a neighbor was added or removed — left for a follow-up
    // rather than done here. For now this just undercounts cellsAdded/cellsRemoved/cellsMoved
    // for an assistant-written session; editCount itself is still right.
    kind: NOTEBOOK_EDIT_KIND.EDIT,
    perform: () => scene.setState({ ...newState, uid: scene.state.uid }),
    undo: () => scene.setState({ ...previousState, uid: scene.state.uid }),
  });

  let appliedNotebook: NotebookSpec | undefined;
  try {
    appliedNotebook = transformNotebookSceneToSaveModel(scene);
    warnings.push(...droppedCellWarnings(notebookSpec, appliedNotebook));
  } catch {
    warnings.push(UNKNOWN_SURVIVORS_WARNING);
  }

  try {
    await scene.autosave.saveDocumentChange({ overwrite: options.onConflict === 'overwrite' });
  } catch (error) {
    return {
      success: false,
      error: `The notebook was changed but could not be saved: ${
        error instanceof Error ? error.message : String(error)
      }`,
      data: { applied: true, spec: appliedNotebook },
      changes: [],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  return {
    success: true,
    data: { applied: true, spec: appliedNotebook, resourceVersion: scene.autosave.state.savedResourceVersion },
    changes: [],
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export const applyNotebookSpecCommand: MutationCommand<ApplyNotebookSpecPayload, NotebookScene> = {
  name: 'APPLY_NOTEBOOK_SPEC',
  description:
    'Replace the notebook with a complete NotebookSpec: settings, elements (markdown, code, panel and ' +
    'library panel cells) and the ordered NotebookLayout that places them. The scene is rebuilt from ' +
    'the spec. The change is saved automatically. Fails without changing anything if the person reading ' +
    'has unsaved panel changes you have not resolved yet (see viewOnlyChanges), or if someone else saved ' +
    'the notebook since it was opened (see onConflict).',

  payloadSchema: applyNotebookSpecPayloadSchema,
  permission: requiresNotebookEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      const refused = await guardNotebookSceneWrite(scene, payload);
      if (refused) {
        return refused;
      }

      const warnings: string[] = [];
      let notebookSpec: NotebookSpec;
      if (payload.validate) {
        const result = validateNotebookSpec(payload.spec);
        if (!result.success || !result.data) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
        warnings.push(...result.warnings);
        notebookSpec = result.data;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
        notebookSpec = payload.spec as unknown as NotebookSpec;
      }

      return await writeNotebookSpecToScene(scene, notebookSpec, {
        viewOnlyChanges: payload.viewOnlyChanges,
        onConflict: payload.onConflict,
        undoLabel: t('notebook.mutation-api.apply-spec.undo-label', 'Assistant edit'),
        editSessionSource: NOTEBOOK_EDIT_SESSION_SOURCE.ASSISTANT,
        warnings,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
