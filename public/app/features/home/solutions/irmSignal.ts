import { isFetchError } from '@grafana/runtime';
import { fetchGrafanaOnCallIntegrations } from 'app/features/alerting/unified/api/onCallApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { PROBE_TIMEOUT_MS, withDeadline } from './probeUtils';
import { type SignalStatus } from './solutionState';

// IRM counts as in use once Grafana Alerting routes into it: the plugin ships preinstalled and
// enabled in Cloud, so plugin status alone would recommend IRM to everyone.
export async function detectIrmSignal(): Promise<SignalStatus> {
  try {
    const integrations = await withDeadline(PROBE_TIMEOUT_MS, undefined, (signal) =>
      fetchGrafanaOnCallIntegrations(SupportedPlugin.Irm, signal)
    );
    return integrations.length > 0 ? 'active' : 'inactive';
  } catch (err) {
    // The resources route 404s when the plugin is absent or disabled: nothing is configured.
    return isFetchError(err) && err.status === 404 ? 'inactive' : 'unknown';
  }
}
