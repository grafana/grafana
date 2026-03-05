import { useMemo } from 'react';

import { useListCheckQuery, type Check } from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { config } from '@grafana/runtime';

const CHECK_TYPE_LABEL = 'advisor.grafana.app/type';
const STATUS_ANNOTATION = 'advisor.grafana.app/status';
const DATASOURCE_CHECK_TYPE = 'datasource';

export type HealthStatus = 'healthy' | 'unhealthy';

export interface AdvisorListHealthState {
  healthMap: Map<string, HealthStatus>;
  lastChecked: string | undefined;
  isLoading: boolean;
  isAvailable: boolean;
}

const EMPTY_STATE: AdvisorListHealthState = {
  healthMap: new Map(),
  lastChecked: undefined,
  isLoading: false,
  isAvailable: false,
};

export function useAdvisorHealthStatus(): AdvisorListHealthState {
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

export function getTimestampMs(timestamp?: string): number | undefined {
  if (!timestamp) {
    return undefined;
  }

  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function isTimestampAfter(left?: string, right?: string): boolean {
  const leftMs = getTimestampMs(left);
  const rightMs = getTimestampMs(right);

  return leftMs !== undefined && rightMs !== undefined && leftMs > rightMs;
}

export function isTimestampOnOrAfter(left?: string, right?: string): boolean {
  const leftMs = getTimestampMs(left);
  const rightMs = getTimestampMs(right);

  return leftMs !== undefined && rightMs !== undefined && leftMs >= rightMs;
}

export function getEffectiveAdvisorHealthMap(
  advisorHealthMap: ReadonlyMap<string, HealthStatus>,
  advisorCheckedAt?: string,
  lastManualSuccessByUid?: ReadonlyMap<string, string> | Readonly<Record<string, string>>
): Map<string, HealthStatus> {
  const effectiveHealthMap = new Map(advisorHealthMap);

  if (!advisorCheckedAt || !lastManualSuccessByUid) {
    return effectiveHealthMap;
  }

  const manualSuccessEntries =
    lastManualSuccessByUid instanceof Map ? lastManualSuccessByUid.entries() : Object.entries(lastManualSuccessByUid);

  for (const [uid, testedAt] of manualSuccessEntries) {
    if (isTimestampAfter(testedAt, advisorCheckedAt)) {
      effectiveHealthMap.delete(uid);
    }
  }

  return effectiveHealthMap;
}

export function findLatestDatasourceCheck(items: Check[]): Check | undefined {
  let latest: Check | undefined;

  for (const check of items) {
    const type = check.metadata.labels?.[CHECK_TYPE_LABEL];
    if (type !== DATASOURCE_CHECK_TYPE) {
      continue;
    }

    if (!latest || isTimestampAfter(check.metadata.creationTimestamp, latest.metadata.creationTimestamp)) {
      latest = check;
    }
  }

  return latest;
}
