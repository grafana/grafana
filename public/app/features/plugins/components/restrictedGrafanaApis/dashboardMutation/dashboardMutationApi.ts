import type { DashboardMutationAPI } from '@grafana/data';
import { ALL_COMMANDS } from 'app/features/dashboard-scene/mutation-api';
import { getDashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/dashboardMutationStore';
import type { MutationRequest } from 'app/features/dashboard-scene/mutation-api/types';

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
