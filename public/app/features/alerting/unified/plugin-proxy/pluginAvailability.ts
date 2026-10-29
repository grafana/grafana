import { getLogger } from '@grafana/runtime/unstable';

import { isPluginEnabled, probePlugin } from '../hooks/pluginBridgeProbe';
import { SupportedPlugin } from '../types/pluginBridges';
import { withTimeout } from '../utils/promise';

const PLUGIN_DISCOVERY_TIMEOUT_MS = 5_000;

export async function isPrometheusAlertingPluginEnabled(): Promise<boolean> {
  try {
    const { settings } = await withTimeout(
      probePlugin(SupportedPlugin.PrometheusAlerting),
      PLUGIN_DISCOVERY_TIMEOUT_MS,
      () => {
        const error = new Error('Timed out while checking Prometheus Alerting plugin status');
        getLogger('features.alerting').logError(error, { timeout: String(PLUGIN_DISCOVERY_TIMEOUT_MS) });
        return error;
      }
    );

    return isPluginEnabled(settings);
  } catch {
    return false;
  }
}
