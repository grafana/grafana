/**
 * GET_SPEC — return the whole document as a single spec, the read half of the
 * full-spec surface (paired with APPLY_SPEC). A thin wrapper over
 * `transformSceneToSaveModelSchemaV2`, so it always reflects the canonical save
 * model.
 *
 * The command is resource-polymorphic: on a dashboard scene it returns a v2
 * `DashboardSpec`, on a notebook scene a v2beta1 `NotebookSpec`, reported via
 * `resource`. The scene serializer is dashboard-typed and always emits the full
 * dashboard shape, so a notebook is projected back down to its own fields before
 * it leaves here — a caller that echoed the dashboard shape back through
 * APPLY_SPEC would be writing `variables`, `annotations` and `cursorSync` into a
 * resource that has no such fields.
 */

import * as z from 'zod';

import { dashboardSpecToNotebookSpec, isNotebookScene } from '../../serialization/notebookSpecTransform';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';
import { validateNotebookSpec } from '../../v2schema/notebookSpecSchema';

import { readOnly, type MutationCommand } from './types';

const getSpecPayloadSchema = z
  .object({
    validate: z
      .boolean()
      .optional()
      .default(false)
      .describe('When true, validate the serialized spec against its schema and fail if it is invalid.'),
  })
  .strict();

export type GetSpecPayload = z.infer<typeof getSpecPayloadSchema>;

export const getSpecCommand: MutationCommand<GetSpecPayload> = {
  name: 'GET_SPEC',
  description:
    'Return the entire document as one spec JSON object: a v2 DashboardSpec on a dashboard, ' +
    'a v2beta1 NotebookSpec on a notebook. The response reports which one in `resource`.',

  payloadSchema: getSpecPayloadSchema,
  permission: readOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      const spec = transformSceneToSaveModelSchemaV2(scene);

      if (isNotebookScene(scene)) {
        const notebook = dashboardSpecToNotebookSpec(spec);

        // Opt-in structural + referential validation (default off to avoid breaking reads).
        // Worth requesting on a notebook: a read that comes back with dangling cell references
        // means the scene lost elements on the way out, which is precisely what this command
        // used to do silently for markdown and code cells.
        if (payload.validate) {
          const result = validateNotebookSpec(notebook);
          if (!result.success) {
            return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
          }
        }

        return { success: true, data: { spec: notebook, resource: 'notebook' }, changes: [] };
      }

      // Opt-in structural validation (default off to avoid breaking reads).
      if (payload.validate) {
        const parsed = dashboardV2SpecSchema.safeParse(spec);
        if (!parsed.success) {
          const errorMessages = parsed.error.issues.map((issue) => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
          });
          return { success: false, error: `Validation failed: ${errorMessages.join(', ')}`, changes: [] };
        }
      }

      return { success: true, data: { spec, resource: 'dashboard' }, changes: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
