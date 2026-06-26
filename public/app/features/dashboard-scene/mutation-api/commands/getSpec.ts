/**
 * GET_SPEC command  [SKETCH — proposed addition]
 *
 * Returns the entire dashboard as a single v2beta1 DashboardSpec JSON object
 * (settings, variables, annotations, elements, and the full nested layout
 * tree). This is the read half of a "full-spec" surface for programmatic
 * callers (e.g. the Grafana Assistant) that want to reason over the whole
 * dashboard as JSON instead of stitching together LIST_PANELS + GET_LAYOUT +
 * LIST_VARIABLES + LIST_ANNOTATIONS and reconstructing the layout by hand.
 *
 * It is a thin wrapper over the existing `transformSceneToSaveModelSchemaV2`
 * serializer, so it always reflects the canonical save model.
 */

import { z } from 'zod';

import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';

import { readOnly, type MutationCommand } from './types';

const getSpecPayloadSchema = z.object({}).strict();

export type GetSpecPayload = z.infer<typeof getSpecPayloadSchema>;

export const getSpecCommand: MutationCommand<GetSpecPayload> = {
  name: 'GET_SPEC',
  description: 'Return the entire dashboard as a v2beta1 DashboardSpec JSON object.',

  payloadSchema: getSpecPayloadSchema,
  // Serialization works regardless of the new-layouts toggle; this is read-only.
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
