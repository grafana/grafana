import { useMemo } from 'react';

import { type DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { createBridgeURL } from '../components/PluginBridge';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { usePluginBridge } from '../hooks/usePluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';
import { getExternalRulesSources } from '../utils/datasource';

/**
 * Is the plugin that owns data source managed alerting there to hand things over to?
 *
 * `installed` is true only when the plugin is both present and enabled, so a plugin that's been
 * switched off is treated the same as one that was never there — the same rule the route proxy
 * follows.
 */
export function usePrometheusAlertingPlugin(): { loading: boolean; installed: boolean } {
  const { loading, installed } = usePluginBridge(SupportedPlugin.PrometheusAlerting);
  return { loading, installed: installed ?? false };
}

/**
 * The rules sources core has handed over to the plugin, so an empty list means there is nothing to
 * hide and nothing to tell anyone about. Callers use the same list to decide both.
 */
export function useHandedOverRulesSources(): DataSourceRulesSourceIdentifier[] {
  const { installed } = usePrometheusAlertingPlugin();
  return useMemo(() => (installed ? getExternalRulesSources() : []), [installed]);
}

/**
 * A link to the plugin's rule list carrying whatever the person has typed into the search box.
 *
 * We forward the raw query rather than re-serializing the parsed filter: both sides speak the same
 * search grammar, and a round trip through the parser reorders and requotes terms, so what lands in
 * the plugin would no longer look like what they typed.
 */
export function usePluginRulesLink(): string {
  const { searchQuery } = useRulesFilter();
  return createBridgeURL(SupportedPlugin.PrometheusAlerting, '/rules', searchQuery ? { search: searchQuery } : {});
}
