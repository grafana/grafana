import { useEffect, useRef } from 'react';

import { DataSourceTestFailed, DataSourceTestSucceeded } from '@grafana/data';

import { getAppEvents } from '../../services';

import { usePluginInteractionReporter } from './usePluginInteractionReporter';

/**
 * Non-sensitive configuration metadata to include in a `grafana_plugin_save_result` event.
 * Values are intentionally restricted to strings to prevent accidentally logging
 * complex objects that may contain credentials or other sensitive data.
 *
 * @example
 * ```ts
 * // Good: configuration choices that are safe to log
 * { auth_type: 'keys', region: 'us-east-1' }
 *
 * // Bad: never include secrets, passwords, tokens, or user-entered data
 * { password: '...', api_key: '...' }
 * ```
 *
 * @alpha
 */
export type ConfigSaveReporterProperties = Record<string, string>;

/**
 * Reports a `grafana_plugin_save_result` interaction event when a datasource
 * configuration save succeeds or fails.
 *
 * @param pluginId - The plugin ID (e.g. `'grafana-cloudwatch-datasource'`)
 * @param getProperties - Returns non-sensitive configuration metadata (e.g. auth type, region)
 *   to include in the event. Called at save time so it always reflects the latest state.
 *   Restrict values to configuration choices — never include secrets, passwords, or user data.
 *
 * @alpha
 */
export function useConfigSaveReporter(pluginId: string, getProperties?: () => ConfigSaveReporterProperties) {
  const report = usePluginInteractionReporter();
  const getPropertiesRef = useRef(getProperties);
  getPropertiesRef.current = getProperties;

  useEffect(() => {
    const successSubscription = getAppEvents().subscribe<DataSourceTestSucceeded>(DataSourceTestSucceeded, () => {
      report('grafana_plugin_save_result', { ...getPropertiesRef.current?.(), plugin_id: pluginId, result: 'success' });
    });
    const failSubscription = getAppEvents().subscribe<DataSourceTestFailed>(DataSourceTestFailed, () => {
      report('grafana_plugin_save_result', { ...getPropertiesRef.current?.(), plugin_id: pluginId, result: 'error' });
    });
    return () => {
      successSubscription.unsubscribe();
      failSubscription.unsubscribe();
    };
  }, [pluginId, report]);
}
