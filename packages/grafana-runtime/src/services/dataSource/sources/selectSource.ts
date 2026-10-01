import { config } from '../../../config';
import { getFeatureFlagClient } from '../../../internal/openFeature';
import { FlagKeys } from '../../../internal/openFeature/openfeature.gen';
import { MT_FILL_PREREQUISITES_MISSING_WARNING } from '../constants';
import { logDataSourceDebug, logDataSourceWarning } from '../logging';

import { BootDataSource } from './bootDataSource';
import { createMTDataSource } from './mt/mtSource';
import { type BootDataSourceSettings, type DataSourceCacheSource } from './types';

interface MTFillGate {
  /** `plugins.initDataSourcesAsync` is on, outside a public dashboard. */
  requested: boolean;
  /** The prerequisites that are off. The MT fill runs only when this is empty. */
  missing: string[];
}

function evaluateMTFillGate(): MTFillGate {
  // Public dashboard viewers are anonymous, and the MT APIs need a signed-in user.
  if (config.publicDashboardAccessToken) {
    return { requested: false, missing: [] };
  }

  const flags = getFeatureFlagClient();
  if (!flags.getBooleanValue(FlagKeys.PluginsInitDataSourcesAsync, false)) {
    return { requested: false, missing: [] };
  }

  const missing: string[] = [];
  // These register the query API group, which serves `connections`.
  if (
    !flags.getBooleanValue(FlagKeys.QueryService, false) &&
    !flags.getBooleanValue(FlagKeys.GrafanaAPIServerWithExperimentalAPIs, false)
  ) {
    missing.push(`${FlagKeys.QueryService}|${FlagKeys.GrafanaAPIServerWithExperimentalAPIs}`);
  }
  if (!flags.getBooleanValue(FlagKeys.QueryServiceWithConnections, false)) {
    missing.push(FlagKeys.QueryServiceWithConnections);
  }
  // The list joins connections with the MT plugin metas.
  if (!flags.getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    missing.push(FlagKeys.PluginsUseMTPlugins);
  }
  // The per-uid settings come from the data source CRUD APIs. The backend flag that registers them
  // is not visible to the frontend, so operators must enable it together with this one.
  if (!flags.getBooleanValue(FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs, false)) {
    missing.push(FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs);
  }

  return { requested: true, missing };
}

/** Whether the async data source cache fills from the MT APIs instead of boot data. */
export function isMTDataSourceFillEnabled(): boolean {
  const gate = evaluateMTFillGate();
  return gate.requested && gate.missing.length === 0;
}

/**
 * The single place that decides which source fills the async data source cache. Removing a
 * source later means deleting its module and its branch here.
 */
export function createDataSourceCacheSource(boot: BootDataSourceSettings): DataSourceCacheSource {
  const gate = evaluateMTFillGate();

  if (gate.requested && gate.missing.length === 0) {
    logDataSourceDebug('DataSource: filling the data source cache from the MT APIs', {});
    return createMTDataSource();
  }

  if (gate.requested) {
    logDataSourceWarning(MT_FILL_PREREQUISITES_MISSING_WARNING, { missing: gate.missing.join(',') });
  }
  logDataSourceDebug('DataSource: filling the data source cache from boot data', {});
  return new BootDataSource(boot);
}
