/**
 * SET_CROSS_DASHBOARD_VARIABLES command
 *
 * Replaces `grafana.app/useCrossDashboardVariables` on the live dashboard.
 * Both scopes `"none"` omit the annotation (opt out). Does not write spec.
 */

import type * as z from 'zod';

import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { serializeUseCrossDashboardVariables } from '../../utils/crossDashboardVariablesSelection';
import {
  parseUseCrossDashboardVariablesFromHost,
  persistUseCrossDashboardVariables,
} from '../../utils/persistUseCrossDashboardVariables';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresGlobalDashboardVariables, type MutationCommand } from './types';

const setCrossDashboardVariablesPayloadSchema = payloads.setCrossDashboardVariables;

export type SetCrossDashboardVariablesPayload = z.infer<typeof setCrossDashboardVariablesPayloadSchema>;

const CHANGE_PATH = `/metadata/annotations/${AnnoKeyUseCrossDashboardVariables}`;

export const setCrossDashboardVariablesCommand: MutationCommand<SetCrossDashboardVariablesPayload> = {
  name: 'SET_CROSS_DASHBOARD_VARIABLES',
  description: payloads.setCrossDashboardVariables.description ?? '',

  payloadSchema: setCrossDashboardVariablesPayloadSchema,
  permission: requiresGlobalDashboardVariables,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const previousSelection = parseUseCrossDashboardVariablesFromHost(scene);
      const previousValue = previousSelection
        ? serializeUseCrossDashboardVariables(previousSelection)
        : undefined;

      await persistUseCrossDashboardVariables(scene, payload);

      const newSelection = parseUseCrossDashboardVariablesFromHost(scene);
      const newValue = newSelection ? serializeUseCrossDashboardVariables(newSelection) : undefined;

      return {
        success: true,
        data: { selection: newSelection },
        changes: [{ path: CHANGE_PATH, previousValue: previousValue ?? null, newValue: newValue ?? null }],
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
