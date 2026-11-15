import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';

import { setDatasourcePluginMetasFromBootData, setDatasourcePluginMetasFromResponse } from './datasources';
import { setPanelPluginMetasFromBootData, setPanelPluginMetasFromResponse } from './panels';
import { refetchPluginMetas } from './plugins';
import type { FrontendSettings } from './types';

/**
 * Refresh the panel and data source plugin metas after a plugin install, update or uninstall.
 * `settings` is an already-fetched `/api/frontend/settings` payload. Without MT plugins the metas
 * come from it; with MT plugins one `/metas` request serves both caches.
 */
export async function refetchPluginMetasAfterPluginChange(settings: FrontendSettings): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    setPanelPluginMetasFromBootData(settings.panels);
    setDatasourcePluginMetasFromBootData(settings.datasources);
    return;
  }

  const metas = await refetchPluginMetas();
  setPanelPluginMetasFromResponse(metas);
  setDatasourcePluginMetasFromResponse(metas);
}
