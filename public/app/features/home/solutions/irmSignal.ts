import { isFetchError } from '@grafana/runtime';
import { fetchGrafanaOnCallIntegrations } from 'app/features/alerting/unified/api/onCallApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { createTtlCachedPromise, PROBE_TIMEOUT_MS, PROBE_TTL_MS, withDeadline } from './probeUtils';
import { type SignalStatus } from './solutionState';

// IRM counts as in use once Grafana Alerting routes into it: the plugin ships preinstalled and
// enabled in Cloud, so plugin status alone would recommend IRM to everyone.
async function fetchIrmSignal(): Promise<SignalStatus> {
  try {
    const integrations = await withDeadline(PROBE_TIMEOUT_MS, undefined, (signal) =>
      fetchGrafanaOnCallIntegrations(SupportedPlugin.Irm, { showErrorAlert: false, abortSignal: signal })
    );
    return integrations.length > 0 ? 'active' : 'inactive';
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

/** Whether Grafana Alerting already routes into IRM. Failures and timeouts reject; the caller maps them to unknown. */
export function detectIrmSignal(): Promise<SignalStatus> {
  return irmSignal.get();
}

export function resetIrmSignal(): void {
  irmSignal.reset();
}
