import { useCallback, useEffect, useRef, useState } from 'react';

import { useCreateCheckMutation, useListCheckQuery } from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { config } from '@grafana/runtime';

import { findLatestDatasourceCheck, isTimestampOnOrAfter } from './useAdvisorHealthStatus';

const CHECK_STATUS_ANNOTATION = 'advisor.grafana.app/status';
const DATASOURCE_CHECK_TYPE = 'datasource';
const POLL_INTERVAL_MS = 2000;

export function useRunHealthChecks() {
  const enabled = Boolean(config.featureToggles.grafanaAdvisor);
  const [isRunning, setIsRunning] = useState(false);
  const runStartedAt = useRef<string | undefined>();

  const [createCheck] = useCreateCheckMutation();
  const { data } = useListCheckQuery(
    {},
    {
      skip: !enabled,
      pollingInterval: isRunning ? POLL_INTERVAL_MS : undefined,
    }
  );

  // Stop polling once the latest datasource check is processed
  useEffect(() => {
    if (!isRunning || !data?.items || !runStartedAt.current) {
      return;
    }
    const latest = findLatestDatasourceCheck(data.items);
    if (!latest) {
      return;
    }
    if (isTimestampOnOrAfter(latest.metadata.creationTimestamp, runStartedAt.current)) {
      const status = latest.metadata.annotations?.[CHECK_STATUS_ANNOTATION];
      if (status === 'processed' || status === 'error') {
        setIsRunning(false);
        runStartedAt.current = undefined;
      }
    }
  }, [isRunning, data]);

  const runHealthChecks = useCallback(async () => {
    if (!enabled || isRunning) {
      return;
    }
    setIsRunning(true);
    runStartedAt.current = new Date().toISOString();
    try {
      await createCheck({
        check: {
          apiVersion: 'advisor.grafana.app/v0alpha1',
          kind: 'Check',
          metadata: {
            generateName: 'check-',
            labels: { 'advisor.grafana.app/type': DATASOURCE_CHECK_TYPE },
          },
          spec: { data: {} },
          status: { report: { count: 0, failures: [] } },
        },
      }).unwrap();
    } catch {
      setIsRunning(false);
      runStartedAt.current = undefined;
    }
  }, [enabled, isRunning, createCheck]);

  // Detect if a check is already in progress on initial data load
  const hasDetectedInitial = useRef(false);
  useEffect(() => {
    if (!data?.items || hasDetectedInitial.current) {
      return;
    }
    hasDetectedInitial.current = true;
    const latest = findLatestDatasourceCheck(data.items);
    if (latest) {
      const status = latest.metadata.annotations?.[CHECK_STATUS_ANNOTATION];
      if (!status) {
        setIsRunning(true);
        runStartedAt.current = latest.metadata.creationTimestamp ?? new Date().toISOString();
      }
    }
  }, [data?.items]);

  return { isRunning, runHealthChecks, enabled };
}
