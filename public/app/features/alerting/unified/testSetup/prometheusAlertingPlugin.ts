import { cleanup } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { addPlugin } from '../mocks/server/configure';
import { SupportedPlugin } from '../types/pluginBridges';

import { pluginMeta } from './plugins';

/**
 * Hands data source managed alerting over to the Prometheus Alerting plugin for every test in the
 * enclosing `describe`. That takes the same three things the route proxy checks: its feature flag,
 * unified alerting, and the plugin being installed and enabled.
 */
export function setupPrometheusAlertingPlugin() {
  const unifiedAlertingEnabled = config.unifiedAlertingEnabled;

  beforeEach(() => {
    config.unifiedAlertingEnabled = true;
    setTestFlags({ [FlagKeys.AlertingDataSourceManagedRouteProxy]: true });
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);
  });

  afterEach(() => {
    config.unifiedAlertingEnabled = unifiedAlertingEnabled;
    // Testing Library unmounts after this hook; resetting flags first would notify still-mounted
    // flag hooks outside act()
    cleanup();
    setTestFlags();
  });
}
