import { useEffect } from 'react';

import { config, isAppPluginInstalled, isFetchError } from '@grafana/runtime';
import { getPluginSettings } from '@grafana/runtime/unstable';

import { logError } from '../Analytics';

import { type AsyncState, useAsync } from './useAsync';

export const PROMETHEUS_ALERTING_APP_ID = 'grafana-prometheusalerting-app';
const DMA_STATUS_TIMEOUT_MS = 5_000;

export const DMAStatus = {
  Loading: 'loading',
  ManagedByGrafana: 'managed-by-grafana',
  ManagedByPlugin: 'managed-by-plugin',
  NotAvailable: 'not-available',
} as const;

type DMAStatusValue = (typeof DMAStatus)[keyof typeof DMAStatus];

export interface DMAState {
  status: DMAStatusValue;
  error?: Error;
}

export function useDMAStatus(): DMAState {
  const disabledByFeatureToggle = config.featureToggles.alertingDisableDMAinUI ?? false;
  const [{ execute }, requestState] = useAsync(isDMAPluginEnabled);

  useEffect(() => {
    execute();
  }, [execute]);

  return getDMAState(requestState, disabledByFeatureToggle);
}

async function isDMAPluginEnabled(): Promise<boolean> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      fetchDMAPluginEnabled(),
      new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => {
          logError(new Error('Timed out while checking Prometheus Alerting plugin status'), {
            timeout: String(DMA_STATUS_TIMEOUT_MS),
          });
          resolve(false);
        }, DMA_STATUS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchDMAPluginEnabled(): Promise<boolean> {
  if (!(await isAppPluginInstalled(PROMETHEUS_ALERTING_APP_ID))) {
    return false;
  }

  try {
    const settings = await getPluginSettings(PROMETHEUS_ALERTING_APP_ID);
    return Boolean(settings.enabled);
  } catch (error) {
    const cause = error instanceof Error ? error.cause : error;
    if (isFetchError(cause) && cause.status === 404) {
      return false;
    }
    throw error;
  }
}

function getDMAState(requestState: AsyncState<boolean | undefined>, disabledByFeatureToggle: boolean): DMAState {
  const error = requestState.error;

  if (requestState.status === 'not-executed' || requestState.status === 'loading') {
    return { status: DMAStatus.Loading, error };
  }

  if (requestState.result) {
    return { status: DMAStatus.ManagedByPlugin, error };
  }

  if (disabledByFeatureToggle) {
    return { status: DMAStatus.NotAvailable, error };
  }

  return { status: DMAStatus.ManagedByGrafana, error };
}
