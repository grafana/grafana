import { reportInteraction } from './utils';

const INTERACTION_NAME = 'grafana_legacy_dashboard_api_used';
const seen = new Set<string>();

/** @public */
export interface LegacyDashboardApiUsage {
  pluginId: string;
  apiName: string;
  extra?: Record<string, unknown>;
}

/** @public */
export const reportLegacyDashboardApiUsage = ({ pluginId, apiName, extra }: LegacyDashboardApiUsage): void => {
  const key = `${pluginId}::${apiName}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);

  console.warn(
    `[grafana] Plugin "${pluginId}" used deprecated dashboard API "${apiName}" and will break in a future major release.`
  );

  reportInteraction(INTERACTION_NAME, { pluginId, apiName, ...(extra ?? {}) });
};

/** @internal — for tests only. */
export function __resetLegacyDashboardApiUsageDedupeForTests(): void {
  seen.clear();
}
