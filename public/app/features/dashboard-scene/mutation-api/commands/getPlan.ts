/**
 * GET_PLAN command
 *
 * Returns the plan an editable preview owns, with the layout the user has arranged, and its
 * revision. While a preview is open this is the plan, not the one that was proposed: the caller
 * reads it here instead of keeping its own copy, so the two can never drift apart.
 */
import * as z from 'zod/mini';

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export type GetPlanPayload = z.infer<typeof payloads.getPlan>;

export const getPlanCommand: MutationCommand<GetPlanPayload> = {
  name: 'GET_PLAN',
  description: z.globalRegistry.get(payloads.getPlan)?.description ?? '',
  payloadSchema: payloads.getPlan,
  permission: readOnly,
  readOnly: true,

  handler: async ({ planId }, { scene }) => {
    const { planning } = scene.state;
    if (planning?.planId !== planId || planning.phase !== 'preview' || !planning.editable) {
      return { success: false, error: 'No editable preview of this plan is open.', changes: [] };
    }

    const { plan, revision } = planning.editable;
    return { success: true, data: { plan, revision }, changes: [] };
  },
};
