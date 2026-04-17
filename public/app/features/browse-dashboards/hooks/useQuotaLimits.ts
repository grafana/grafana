import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type GetUsageResponse, useGetUsageQuery } from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { config } from '@grafana/runtime';

const WARNING_THRESHOLD = 0.85;

export type QuotaState = 'ok' | 'nearing' | 'at_limit';

export interface ResourceStatus {
  kind: 'dashboards' | 'folders';
  state: QuotaState;
  usage: number;
  limit: number;
}

function getQuotaState(usage: number, limit: number): QuotaState {
  if (limit <= 0) {
    return 'ok';
  }
  if (usage >= limit) {
    return 'at_limit';
  }
  if (usage / limit >= WARNING_THRESHOLD) {
    return 'nearing';
  }
  return 'ok';
}

function buildResourceStatus(data: GetUsageResponse | undefined, kind: ResourceStatus['kind']): ResourceStatus | null {
  if (!data) {
    return null;
  }
  const state = getQuotaState(data.usage, data.limit);
  return state === 'ok' ? null : { kind, state, usage: data.usage, limit: data.limit };
}

export function useQuotaLimits() {
  const featureEnabled = Boolean(config.featureToggles.kubernetesUnifiedStorageQuotas);
  const dashboardQuery = useGetUsageQuery(
    featureEnabled ? { group: DASHBOARD_API_GROUP, resource: 'dashboards' } : skipToken
  );
  const folderQuery = useGetUsageQuery(featureEnabled ? { group: FOLDER_API_GROUP, resource: 'folders' } : skipToken);

  const isLoading = dashboardQuery.isLoading || folderQuery.isLoading;
  const allQueriesFailed = Boolean(dashboardQuery.error && folderQuery.error);

  const resources = useMemo(
    () =>
      [[dashboardQuery.data, 'dashboards'] as const, [folderQuery.data, 'folders'] as const]
        .map(([query, group]) => buildResourceStatus(query, group))
        .filter((r): r is ResourceStatus => r !== null),
    [dashboardQuery.data, folderQuery.data]
  );
  return { resources, isLoading, allQueriesFailed, featureEnabled };
}
