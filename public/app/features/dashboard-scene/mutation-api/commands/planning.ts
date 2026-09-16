import type * as z from 'zod';

import { startPlanningSession, endPlanningSession } from '../../scene/planningSession';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const startPlanningCommand: MutationCommand<z.infer<typeof payloads.startPlanning>> = {
  name: 'START_PLANNING',
  description: 'Preview a dashboard plan with query-less sample panels.',
  payloadSchema: payloads.startPlanning,
  permission: requiresEdit,
  handler: async (payload, { scene }) => {
    enterEditModeIfNeeded(scene);
    startPlanningSession(scene, payload);
    return { success: true, changes: [], data: { planId: payload.planId } };
  },
};

export const endPlanningCommand: MutationCommand<z.infer<typeof payloads.endPlanning>> = {
  name: 'END_PLANNING',
  description: 'End the matching preview, optionally removing its scaffold.',
  payloadSchema: payloads.endPlanning,
  permission: requiresEdit,
  handler: async ({ planId, discard }, { scene }) => {
    const warnings = endPlanningSession(scene, planId, discard);
    return { success: true, changes: [], warnings: warnings.length > 0 ? warnings : undefined };
  },
};
