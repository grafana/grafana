/**
 * GET_SPEC — return the whole dashboard as a single v2 DashboardSpec, the read
 * half of the full-spec surface (paired with APPLY_SPEC). A thin wrapper over
 * `transformSceneToSaveModelSchemaV2`, so it always reflects the canonical save
 * model.
 */

import { z } from 'zod';

import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';

import { readOnly, type MutationCommand } from './types';

const getSpecPayloadSchema = z.object({}).strict();

export type GetSpecPayload = z.infer<typeof getSpecPayloadSchema>;

export const getSpecCommand: MutationCommand<GetSpecPayload> = {
  name: 'GET_SPEC',
  description: 'Return the entire dashboard as a v2 DashboardSpec JSON object.',

  payloadSchema: getSpecPayloadSchema,
  permission: readOnly,
  readOnly: true,

  handler: async (_payload, context) => {
    const { scene } = context;
    try {
      const spec = transformSceneToSaveModelSchemaV2(scene);
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
