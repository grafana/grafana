import { resolvePluginIdFromStack } from '@grafana/data';

import { reportInteraction } from './utils';

export { resolvePluginIdFromStack };

const INTERACTION_NAME = 'grafana_legacy_dashboard_api_used';
const seen = new Set<string>();

export interface LegacyDashboardApiUsage {
  pluginId: string;
  apiName: string;
  extra?: Record<string, unknown>;
}

export function reportLegacyDashboardApiUsage({ pluginId, apiName, extra }: LegacyDashboardApiUsage): void {
  const key = `${pluginId}::${apiName}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);

  console.warn(
    `[grafana] Plugin "${pluginId}" used legacy dashboard API "${apiName}". This API is scheduled for removal — see the legacy-dashboard-api-deprecation migration guide.`
  );

  reportInteraction(INTERACTION_NAME, { pluginId, apiName, ...(extra ?? {}) });
}

/** @internal — for tests only. */
export function __resetLegacyDashboardApiUsageDedupeForTests(): void {
  seen.clear();
}
