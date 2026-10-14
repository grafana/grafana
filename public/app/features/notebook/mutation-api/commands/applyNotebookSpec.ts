import * as z from 'zod';

import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';

import { applyNotebookSpec } from '../../actions/applyNotebookSpec';
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
  })
  .strict();

export type ApplyNotebookSpecPayload = z.infer<typeof applyNotebookSpecPayloadSchema>;

export const applyNotebookSpecCommand: MutationCommand<ApplyNotebookSpecPayload, NotebookScene> = {
  name: 'APPLY_NOTEBOOK_SPEC',
  description:
    'Replace the notebook with a complete NotebookSpec: settings, elements (markdown, code, panel and ' +
    'library panel cells) and the ordered NotebookLayout that places them. The scene is rebuilt from ' +
    'the spec. The change is saved automatically. Fails without changing anything if the person reading ' +
    'has unsaved panel changes you have not resolved yet (see viewOnlyChanges).',

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
        await scene.autosave.saveDocumentChange();
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
