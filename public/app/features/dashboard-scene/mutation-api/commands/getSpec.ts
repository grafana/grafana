/**
 * GET_SPEC — return the whole dashboard as a single v2 `DashboardSpec`, the read
 * half of the full-spec surface (paired with APPLY_SPEC). A thin wrapper over
 * `transformSceneToSaveModelSchemaV2`, so it always reflects the canonical save
 * model.
 *
 * A notebook is answered too, by forwarding to GET_NOTEBOOK_SPEC. That is
 * compatibility rather than design: the assistant plugin is released on its own
 * schedule and looks for this command by name when it decides whether a page can
 * be read at all, so refusing a notebook here would break notebook pages for
 * every plugin version already out there.
 */

import * as z from 'zod';

import { isNotebookScene } from '../../serialization/notebookSpecTransform';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';

import { getNotebookSpecCommand } from './getNotebookSpec';
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
    'Return the entire dashboard as one v2 DashboardSpec JSON object: settings, variables, ' +
    'annotations, panels and the nested rows/tabs layout. Also accepted on a notebook, where it ' +
    'returns a v2beta1 NotebookSpec and GET_NOTEBOOK_SPEC is the command to prefer. The response ' +
    'reports which one it returned in `resource`.',

  payloadSchema: getSpecPayloadSchema,
  permission: readOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      // Compatibility forward, see the docstring for why it cannot simply refuse. This branch goes
      // when no released assistant plugin version still asks for GET_SPEC on a notebook page.
      if (isNotebookScene(scene)) {
        return getNotebookSpecCommand.handler(payload, context);
      }

      const spec = transformSceneToSaveModelSchemaV2(scene);

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
