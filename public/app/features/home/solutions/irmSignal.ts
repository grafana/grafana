import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  type AlertReceiveChannelsResult,
  getProxyApiUrl,
  readOnCallIntegrations,
} from 'app/features/alerting/unified/api/onCallApi';
import { GRAFANA_ONCALL_INTEGRATION_TYPE } from 'app/features/alerting/unified/components/receivers/grafanaAppReceivers/onCall/onCall';

import { IRM_APP_ID } from './appPluginIds';
import { createTtlCachedPromise, PROBE_TIMEOUT_MS, PROBE_TTL_MS, withDeadline } from './probeUtils';
import { type SignalStatus } from './solutionState';

// IRM counts as in use once Grafana Alerting routes into it: the plugin ships preinstalled and
// enabled in Cloud, so plugin status alone would recommend IRM to everyone.
async function fetchIrmSignal(): Promise<SignalStatus> {
  try {
    const response = await withDeadline(PROBE_TIMEOUT_MS, undefined, (signal) =>
      getBackendSrv().get<AlertReceiveChannelsResult>(
        getProxyApiUrl('/alert_receive_channels/', IRM_APP_ID),
        // Same request the alerting contact-point editor makes; legacy_grafana_alerting still counts.
        {
          filters: true,
          integration: [GRAFANA_ONCALL_INTEGRATION_TYPE, 'legacy_grafana_alerting'],
          skip_pagination: true,
        },
        undefined,
        { showErrorAlert: false, abortSignal: signal }
      )
    );
    return readOnCallIntegrations(response).length > 0 ? 'active' : 'inactive';
  } catch (err) {
    // No proxy route means the plugin is absent or disabled: nothing is configured, so not in use.
    if (isFetchError(err) && err.status === 404) {
      return 'inactive';
    }
    throw err;
  }
}

// Definitive answers are shared for the TTL window; rejections are evicted so the next read retries.
const irmSignal = createTtlCachedPromise(fetchIrmSignal, PROBE_TTL_MS);

/** Whether Grafana Alerting already routes into IRM. Failures and timeouts read as unknown and never reject. */
export function detectIrmSignal(): Promise<SignalStatus> {
  return irmSignal.get().catch((): SignalStatus => 'unknown');
}

export function resetIrmSignal(): void {
  irmSignal.reset();
}
