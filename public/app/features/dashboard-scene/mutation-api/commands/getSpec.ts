/**
 * GET_SPEC — return the whole dashboard as a single v2 `DashboardSpec`, the read
 * half of the full-spec surface (paired with APPLY_SPEC). A thin wrapper over
 * `transformSceneToSaveModelSchemaV2`, so it always reflects the canonical save
 * model.
 *
 * Dashboard-only. A notebook is refused, with GET_NOTEBOOK_SPEC named in the
 * error: one command, one spec. Answering both would mean describing two schemas
 * and a rule for choosing between them, and the dashboard serializer cannot
 * produce a notebook anyway — it drops every narrative cell.
 */

import * as z from 'zod';

import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';

import { requiresDashboardResource, type MutationCommand } from './types';

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
    'annotations, panels and the nested rows/tabs layout. Dashboards only: on a notebook it is ' +
    'refused, and GET_NOTEBOOK_SPEC is the command to use.',

  payloadSchema: getSpecPayloadSchema,
  permission: requiresDashboardResource,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
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

      return { success: true, data: { spec }, changes: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
