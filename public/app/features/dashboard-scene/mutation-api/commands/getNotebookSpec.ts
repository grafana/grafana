/**
 * GET_NOTEBOOK_SPEC — return the whole notebook as a single v2beta1 `NotebookSpec`, the read half of
 * the notebook full-spec surface (paired with APPLY_NOTEBOOK_SPEC).
 *
 * One command, one spec. `GET_SPEC` also answers on a notebook, but it answers with whichever spec
 * the scene happens to render, so it cannot be described without naming two schemas and a rule for
 * choosing between them. This command exists so a caller that knows it is looking at a notebook can
 * say so, and so the notebook read survives the v2 `DashboardSpec` being retired.
 */

import * as z from 'zod';

import { validateNotebookSpec } from 'app/features/notebook/schema/notebookSpecSchema';
import { transformSceneToNotebookSaveModel } from 'app/features/notebook/serialization/transformSceneToNotebookSaveModel';

import { requiresNotebookResource, type MutationCommand } from './types';

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

export const getNotebookSpecCommand: MutationCommand<GetNotebookSpecPayload> = {
  name: 'GET_NOTEBOOK_SPEC',
  description:
    'Return the entire notebook as one v2beta1 NotebookSpec JSON object: settings, elements ' +
    '(markdown, code, panel and library panel cells) and the ordered NotebookLayout that places them.',

  payloadSchema: getNotebookSpecPayloadSchema,
  permission: requiresNotebookResource,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      const notebook = transformSceneToNotebookSaveModel(scene);

      // Opt-in structural + referential validation (default off to avoid breaking reads).
      // Worth requesting on a notebook: a read that comes back with dangling cell references means
      // the scene lost elements on the way out, which is precisely what this used to do silently
      // for markdown and code cells.
      if (payload.validate) {
        const result = validateNotebookSpec(notebook);
        if (!result.success) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
      }

      return { success: true, data: { spec: notebook, resource: 'notebook' }, changes: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
