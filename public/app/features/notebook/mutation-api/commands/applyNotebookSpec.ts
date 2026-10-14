import * as z from 'zod';

import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';

import { applyNotebookSpec } from '../../actions/applyNotebookSpec';
import { readNotebookResourceVersion } from '../../api/notebookResource';
import { type NotebookScene } from '../../scene/NotebookScene';

import { requiresNotebookEdit } from './permissions';

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
      // Composer holds the notebook while it is open: its session is the only writer, and its saves wait
      // for it to end, so a write from here would neither go through it nor save.
      if (scene.getComposerSession()) {
        return {
          success: false,
          error: 'Composer is open on this notebook. Edit it through the Composer session.',
          changes: [],
        };
      }

      // Refused before the scene is touched, for the same reason as unresolved view-only changes: whoever
      // asked for this write is in a conversation and chooses there, rather than facing the overwrite modal
      // afterwards over a change that is already on screen.
      if (
        scene.state.uid &&
        scene.autosave.state.savedResourceVersion !== undefined &&
        payload.onConflict !== 'overwrite'
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

      const result = await applyNotebookSpec(scene, payload.spec, {
        validate: payload.validate,
        viewOnlyChanges: payload.viewOnlyChanges,
        enterEditMode: true,
      });
      if (result.status === 'view_only_changes') {
        return {
          success: false,
          error:
            `This notebook has unsaved view-only changes to: ${result.elements.join(', ')}. Ask ` +
            'the person reading whether to keep or discard them, then retry with viewOnlyChanges set to ' +
            '"keep" or "discard".',
          changes: [],
        };
      }
      if (result.status !== 'applied') {
        return { success: false, error: result.status === 'invalid' ? result.error : 'Refused.', changes: [] };
      }
      const { spec: appliedNotebook, warnings } = result;

      try {
        await scene.autosave.saveDocumentChange({ overwrite: payload.onConflict === 'overwrite' });
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
