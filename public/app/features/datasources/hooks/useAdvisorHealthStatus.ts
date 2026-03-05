import { useMemo } from 'react';

import { config } from '@grafana/runtime';

import { useListCheckQuery, type Check } from '@grafana/api-clients/rtkq/advisor/v0alpha1';

const CHECK_TYPE_LABEL = 'advisor.grafana.app/type';
const STATUS_ANNOTATION = 'advisor.grafana.app/status';
const DATASOURCE_CHECK_TYPE = 'datasource';

export type HealthStatus = 'healthy' | 'unhealthy';

export interface AdvisorHealthState {
  healthMap: Map<string, HealthStatus>;
  lastChecked: string | undefined;
  isLoading: boolean;
  isAvailable: boolean;
}

const EMPTY_STATE: AdvisorHealthState = {
  healthMap: new Map(),
  lastChecked: undefined,
  isLoading: false,
  isAvailable: false,
};

export function useAdvisorHealthStatus(): AdvisorHealthState {
  const enabled = Boolean(config.featureToggles.grafanaAdvisor);

  const { data, isLoading, isError } = useListCheckQuery({}, { skip: !enabled });

  return useMemo(() => {
    if (!enabled || isError) {
      return EMPTY_STATE;
    }

    if (isLoading) {
      return { ...EMPTY_STATE, isLoading: true };
    }

    if (!data?.items) {
      return EMPTY_STATE;
    }

    // Find the latest datasource check
    const dsCheck = findLatestDatasourceCheck(data.items);
    if (!dsCheck) {
      return EMPTY_STATE;
    }

    // Only use completed checks (ones with a status annotation)
    const statusAnnotation = dsCheck.metadata.annotations?.[STATUS_ANNOTATION];
    if (!statusAnnotation || statusAnnotation === 'error') {
      return EMPTY_STATE;
    }

    const healthMap = new Map<string, HealthStatus>();
    const failures = dsCheck.status?.report?.failures ?? [];

    for (const failure of failures) {
      healthMap.set(failure.itemID, 'unhealthy');
    }

    return {
      healthMap,
      lastChecked: dsCheck.metadata.creationTimestamp,
      isLoading: false,
      isAvailable: true,
    };
  }, [enabled, data, isLoading, isError]);
}

export function findLatestDatasourceCheck(items: Check[]): Check | undefined {
  let latest: Check | undefined;

  for (const check of items) {
    const type = check.metadata.labels?.[CHECK_TYPE_LABEL];
    if (type !== DATASOURCE_CHECK_TYPE) {
      continue;
    }

    if (
      !latest ||
      new Date(check.metadata.creationTimestamp ?? 0) > new Date(latest.metadata.creationTimestamp ?? 0)
    ) {
      latest = check;
    }
  }

  return latest;
}
