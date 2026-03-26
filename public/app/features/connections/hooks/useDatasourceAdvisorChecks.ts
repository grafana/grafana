import { useMemo } from 'react';

import { Check, CheckType, useGetCheckTypeQuery, useListCheckQuery } from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { config } from '@grafana/runtime';

export type FailureSeverity = 'high' | 'low';

const CHECK_TYPE_LABEL = 'advisor.grafana.app/type';

export type DatasourceFailureDetails = {
  severity: FailureSeverity;
  message?: string;
};

const EMPTY_MAP = new Map<string, DatasourceFailureDetails>();

/**
 * Fetches all datasource-type advisor checks and returns the most recent one
 * (by creationTimestamp). Skips the query when the Advisor feature is disabled.
 */
export function useLatestDatasourceCheck(): { check: Check | undefined; isLoading: boolean } {
  const enabled = Boolean(config.featureToggles.grafanaAdvisor && config.featureToggles.advisorDatasourceIntegration);

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
