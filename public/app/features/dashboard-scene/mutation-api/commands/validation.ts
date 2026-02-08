/**
 * Shared validation helpers for mutation command handlers.
 *
 * These run at execution time (not schema parse time) so they can safely
 * access runtime services like config and getDataSourceSrv.
 */

import { config, getDataSourceSrv } from '@grafana/runtime';

/**
 * Validate that a panel plugin ID exists in the current Grafana instance.
 * Returns an error message string if invalid, or undefined if valid.
 */
export function validatePluginId(pluginId: string): string | undefined {
  if (!config.panels[pluginId]) {
    const available = Object.keys(config.panels)
      .filter((id) => !config.panels[id].hideFromList)
      .join(', ');
    return `Unknown panel plugin: "${pluginId}". Available plugins: ${available}`;
  }
  return undefined;
}

interface QueryRef {
  spec: {
    query: {
      group: string;
      datasource?: { name?: string };
    };
  };
}

/**
 * Validate that all datasource references in a list of panel queries resolve
 * to existing datasources. Skips validation when datasource is unset (the
 * handler resolves a default) or when the name starts with $ (template variable).
 * Returns an error message string if any reference is invalid, or undefined if all valid.
 */
export function validateDatasourceRefs(queries?: QueryRef[]): string | undefined {
  if (!queries?.length) {
    return undefined;
  }

  for (const panelQuery of queries) {
    const { group, datasource } = panelQuery.spec.query;
    if (!datasource?.name || datasource.name.startsWith('$')) {
      continue;
    }

    const ds = getDataSourceSrv().getInstanceSettings({ type: group, uid: datasource.name });
    if (!ds) {
      return `Datasource not found: type="${group}", name="${datasource.name}"`;
    }
  }

  return undefined;
}
