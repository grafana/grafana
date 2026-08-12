/**
 * GET_NOTEBOOK_SPEC — return the whole notebook as a single `NotebookSpec`, the read half of the
 * notebook full-spec surface (paired with APPLY_NOTEBOOK_SPEC).
 *
 * One command, one spec. There is no dashboard command that also answers here: a notebook's client is
 * built from the notebook command list, so GET_SPEC is not registered on this page at all. That is
 * what lets this command be described to a model without naming two schemas and a rule for choosing
 * between them.
 */

import * as z from 'zod';

import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';

import { type NotebookScene } from '../../scene/NotebookScene';
import { validateNotebookSpec } from '../../schema/notebookSpecSchema';
import { transformNotebookSceneToSaveModel } from '../../serialization/transformNotebookSceneToSaveModel';

import { requiresNotebookRead } from './permissions';

const getNotebookSpecPayloadSchema = z
  .object({
    validate: z
      .boolean()
      .optional()
      .default(false)
      .describe('When true, validate the serialized spec against the notebook schema and fail if it is invalid.'),
  })
  .strict();

export type GetNotebookSpecPayload = z.infer<typeof getNotebookSpecPayloadSchema>;

export const getNotebookSpecCommand: MutationCommand<GetNotebookSpecPayload, NotebookScene> = {
  name: 'GET_NOTEBOOK_SPEC',
  description:
    'Return the entire notebook as one NotebookSpec JSON object: settings, elements (markdown, code, ' +
    'panel and library panel cells) and the ordered NotebookLayout that places them. Panel elements ' +
    'use the same shape as a dashboard v2 spec.',

  payloadSchema: getNotebookSpecPayloadSchema,
  permission: requiresNotebookRead,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      const notebook = transformNotebookSceneToSaveModel(scene);

      // Opt-in structural + referential validation (default off to avoid breaking reads). Worth
      // requesting on a notebook: a read that comes back with dangling cell references means the
      // scene lost elements on the way out.
      let warnings: string[] = [];
      if (payload.validate) {
        const result = validateNotebookSpec(notebook);
        if (!result.success) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
        // An orphaned element is not a reason to fail a read, but it is worth saying on one: the spec
        // the caller is about to edit carries an element that renders nowhere.
        warnings = result.warnings;
      }

      return {
        success: true,
        data: { spec: notebook },
        changes: [],
        ...(warnings.length > 0 ? { warnings } : {}),
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
