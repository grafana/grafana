/**
 * Dashboard Mutation API -- Restricted API wrapper.
 *
 * This module provides the API object exposed to plugins via RestrictedGrafanaApis.
 *
 * The active MutationClient is managed by DashboardMutationBehavior (a $behavior
 * on DashboardScene) which stores it in dashboardMutationStore on
 * activation and clears it on deactivation.
 *
 * Plugins access this through RestrictedGrafanaApis context -- they cannot
 * import this module directly because it lives inside the core bundle.
 */

import type { DashboardMutationAPI } from '@grafana/data';
import { ALL_COMMANDS } from 'app/features/dashboard-scene/mutation-api';
import type { MutationRequest } from 'app/features/dashboard-scene/mutation-api/types';

import { getDashboardMutationClient } from './dashboardMutationStore';

export const dashboardMutationApi: DashboardMutationAPI = {
  execute: (mutation: MutationRequest) => {
    const client = getDashboardMutationClient();
    if (!client) {
      return Promise.reject(new Error('Dashboard Mutation API is not available. No dashboard is currently loaded.'));
    }
    return client.execute(mutation);
  },
  getPayloadSchema: (commandId: string) => {
    const normalized = commandId.toUpperCase();
    const cmd = ALL_COMMANDS.find((c) => c.name === normalized);
    return cmd?.payloadSchema ?? null;
  },
};
