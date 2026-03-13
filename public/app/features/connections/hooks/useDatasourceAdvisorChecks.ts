import { useCallback, useMemo } from 'react';

import { Check, useListCheckQuery, useUpdateCheckMutation } from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { config } from '@grafana/runtime';

export type FailureSeverity = 'high' | 'low';

const EMPTY_MAP = new Map<string, FailureSeverity>();

function isAdvisorEnabled(): boolean {
  return Boolean(config.featureToggles.grafanaAdvisor && config.featureToggles.advisorDatasourceIntegration);
}

/**
 * Fetches all datasource-type advisor checks and returns the most recent one
 * (by creationTimestamp). Skips the query when the Advisor feature is disabled.
 */
export function useLatestDatasourceCheck(): { check: Check | undefined; isLoading: boolean } {
  const enabled = isAdvisorEnabled();

  const { data, isLoading } = useListCheckQuery(
    { labelSelector: 'advisor.grafana.app/type=datasource', limit: 1000 },
    { skip: !enabled }
  );

  const check = useMemo(() => {
    const items = data?.items;
    if (!items?.length) {
      return undefined;
    }
    return items.reduce((latest, current) => {
      const latestTime = latest.metadata.creationTimestamp ?? '';
      const currentTime = current.metadata.creationTimestamp ?? '';
      return currentTime > latestTime ? current : latest;
    });
  }, [data?.items]);

  return { check, isLoading: enabled && isLoading };
}

export type DatasourceFailuresResult = {
  /** Map of datasource UID to the highest severity among its failures. Only datasources with at least one failure are included. */
  datasourceFailureByUID: Map<string, FailureSeverity>;
  isLoading: boolean;
};

/**
 * Returns a Map of datasource UIDs that have any failure in the latest datasource
 * advisor check, to the highest severity among their failures.
 */
export function useFailedDatasourcesUIDs(): DatasourceFailuresResult {
  const { check, isLoading } = useLatestDatasourceCheck();

  const datasourceFailureByUID = useMemo(() => {
    const failures = check?.status?.report?.failures;
    if (!failures?.length) {
      return EMPTY_MAP;
    }

    const byUID = new Map<string, FailureSeverity>();
    for (const failure of failures) {
      const uid = failure.itemID;
      const severity = failure.severity;
      const existing = byUID.get(uid);
      if (existing === undefined || severity === 'high') {
        byUID.set(uid, severity);
      }
    }
    return byUID;
  }, [check]);

  return { datasourceFailureByUID, isLoading };
}

/**
 * Returns a callback that PATCHes the latest datasource advisor check to add a
 * retry annotation for the given datasource UID.
 * No-ops when advisor is disabled or no check exists yet.
 */
export function useRetryDatasourceAdvisorCheck(): (datasourceUID: string) => Promise<void> {
  const { check } = useLatestDatasourceCheck();
  const [updateCheck] = useUpdateCheckMutation();

  return useCallback(
    async (datasourceUID: string) => {
      const checkName = check?.metadata.name;
      if (!isAdvisorEnabled() || !checkName) {
        return;
      }

      await updateCheck({
        name: checkName,
        patch: [
          {
            op: 'add',
            path: '/metadata/annotations/advisor.grafana.app~1retry',
            value: datasourceUID,
          },
        ],
      }).unwrap();
    },
    [check?.metadata.name, updateCheck]
  );
}
