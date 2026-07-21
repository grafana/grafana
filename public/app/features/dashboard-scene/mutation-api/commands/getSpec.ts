/**
 * GET_SPEC — return the whole dashboard as a single v2 DashboardSpec, the read
 * half of the full-spec surface (paired with APPLY_SPEC). A thin wrapper over
 * `transformSceneToSaveModelSchemaV2`, so it always reflects the canonical save
 * model.
 */

import { z } from 'zod';

import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';

import { readOnly, type MutationCommand } from './types';

const getSpecPayloadSchema = z
  .object({
    validate: z
      .boolean()
      .optional()
      .default(false)
      .describe('When true, validate the serialized spec against the v2 schema and fail if it is invalid.'),
  })
  .strict();

export type GetSpecPayload = z.infer<typeof getSpecPayloadSchema>;

export const getSpecCommand: MutationCommand<GetSpecPayload> = {
  name: 'GET_SPEC',
  description: 'Return the entire dashboard as a v2 DashboardSpec JSON object.',

  payloadSchema: getSpecPayloadSchema,
  permission: readOnly,
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
