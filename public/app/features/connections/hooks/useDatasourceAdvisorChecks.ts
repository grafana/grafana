import { useCallback, useEffect, useMemo } from 'react';

import {
  Check,
  CheckType,
  useGetCheckTypeQuery,
  useListCheckQuery,
  useUpdateCheckMutation,
} from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { config } from '@grafana/runtime';

export type FailureSeverity = 'high' | 'low';

const CHECK_TYPE_LABEL = 'advisor.grafana.app/type';
const RETRY_ANNOTATION = 'advisor.grafana.app/retry';
const STATUS_ANNOTATION = 'advisor.grafana.app/status';
const REFRESH_PENDING_RETRY_INTERVAL_MS = 2000;

export type DatasourceFailureDetails = {
  severity: FailureSeverity;
  message?: string;
};

const EMPTY_MAP = new Map<string, DatasourceFailureDetails>();

function isAdvisorEnabled(): boolean {
  return Boolean(config.featureToggles.grafanaAdvisor && config.featureToggles.advisorDatasourceIntegration);
}

/**
 * Fetches datasource-type advisor checks and returns the latest one.
 * Skips the query when the Advisor feature is disabled.
 */
export function useLatestDatasourceCheck(): {
  check: Check | undefined;
  isLoading: boolean;
  refetchLatestCheck: () => void;
} {
  const enabled = isAdvisorEnabled();

  const { data, isLoading, refetch } = useListCheckQuery(
    { labelSelector: 'advisor.grafana.app/type=datasource', limit: 1000 },
    { skip: !enabled }
  );
  const check = useMemo(() => selectLatestCheck(data?.items), [data?.items]);

  useEffect(() => {
    if (!enabled || !isPending(check)) {
      return;
    }

    const interval = setInterval(refetch, REFRESH_PENDING_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, check, refetch]);

  return { check, isLoading: enabled && isLoading, refetchLatestCheck: refetch };
}

function selectLatestCheck(checks?: Check[]): Check | undefined {
  if (!checks?.length) {
    return undefined;
  }

  return checks.reduce((latest, current) => {
    const currentTimestamp = Date.parse(current.metadata.creationTimestamp ?? '');
    const latestTimestamp = Date.parse(latest.metadata.creationTimestamp ?? '');
    return currentTimestamp > latestTimestamp ? current : latest;
  });
}

function isPending(check?: Check): boolean {
  return (
    !check?.metadata.annotations?.[STATUS_ANNOTATION] ||
    (check.metadata.annotations?.[RETRY_ANNOTATION] !== undefined &&
      check.metadata.annotations?.[STATUS_ANNOTATION] !== 'error')
  );
}

export type DatasourceFailuresResult = {
  /** Map of datasource UID to the highest severity among its failures. Only datasources with at least one failure are included. */
  datasourceFailureByUID: Map<string, DatasourceFailureDetails>;
  isLoading: boolean;
};

/**
 * Returns a Map of datasource UIDs that have any failure in the latest datasource
 * advisor check, to the highest severity among their failures.
 */
export function useDatasourceFailureByUID(): DatasourceFailuresResult {
  const { check, isLoading } = useLatestDatasourceCheck();
  const checkTypeName = check?.metadata.labels?.[CHECK_TYPE_LABEL];
  const { data: checkType, isLoading: isCheckTypeLoading } = useGetCheckTypeQuery(
    { name: checkTypeName ?? '' },
    { skip: !checkTypeName }
  );

  const datasourceFailureByUID = useMemo(() => {
    const failures = check?.status?.report?.failures;
    if (!failures?.length) {
      return EMPTY_MAP;
    }

    const stepByID = getStepMap(checkType);
    const byUID = new Map<string, DatasourceFailureDetails>();
    for (const failure of failures) {
      const uid = failure.itemID;
      const severity = failure.severity;
      const existing = byUID.get(uid);
      if (existing === undefined || (existing.severity !== 'high' && severity === 'high')) {
        const step = stepByID.get(failure.stepID);
        const message = step ? `${step.title} failed: ${step.resolution}` : undefined;
        byUID.set(uid, { severity, message });
      }
    }
    return byUID;
  }, [check, checkType]);

  return { datasourceFailureByUID, isLoading: isLoading || (Boolean(checkTypeName) && isCheckTypeLoading) };
}

function getStepMap(checkType: CheckType | undefined): Map<string, CheckType['spec']['steps'][number]> {
  const stepByID = new Map<string, CheckType['spec']['steps'][number]>();
  for (const step of checkType?.spec.steps ?? []) {
    stepByID.set(step.stepID, step);
  }
  return stepByID;
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
