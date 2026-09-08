/**
 * GET_CROSS_DASHBOARD_VARIABLES command
 *
 * Returns the dashboard's `grafana.app/useCrossDashboardVariables` selection
 * plus the predefined variable names available in each scope. Read-only.
 */

import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { parseUseCrossDashboardVariablesFromHost } from '../../utils/persistUseCrossDashboardVariables';
import { fetchPredefinedVariables, getPredefinedOrigin } from '../../utils/predefinedVariables';

import { payloads } from './schemas';
import { requiresGlobalDashboardVariablesReadOnly, type MutationCommand } from './types';

const getCrossDashboardVariablesPayloadSchema = payloads.getCrossDashboardVariables;

function availableNames(variables: VariableKind[]): { global: string[]; folder: string[] } {
  const global: string[] = [];
  const folder: string[] = [];
  for (const variable of variables) {
    const origin = getPredefinedOrigin(variable.spec.origin);
    if (origin?.type === 'global') {
      global.push(variable.spec.name);
    } else if (origin?.type === 'folder') {
      folder.push(variable.spec.name);
    }
  }
  return { global, folder };
}

export const getCrossDashboardVariablesCommand: MutationCommand<Record<string, never>> = {
  name: 'GET_CROSS_DASHBOARD_VARIABLES',
  description: payloads.getCrossDashboardVariables.description ?? '',

  payloadSchema: getCrossDashboardVariablesPayloadSchema,
  permission: requiresGlobalDashboardVariablesReadOnly,
  readOnly: true,

  handler: async (_payload, context) => {
    const { scene } = context;

    try {
      const selection = parseUseCrossDashboardVariablesFromHost(scene);
      const candidates = await fetchPredefinedVariables(scene.state.meta.folderUid);
      if (candidates === null) {
        return {
          success: true,
          data: { selection, available: { global: [], folder: [] } },
          changes: [],
          warnings: ['Could not load global and folder variables'],
        };
      }

      return {
        success: true,
        data: {
          selection,
          available: availableNames(candidates),
        },
        changes: [],
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
