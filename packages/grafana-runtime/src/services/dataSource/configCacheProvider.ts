import { type DataSourceInstanceSettings } from '@grafana/data';

import { getBackendSrv } from '../backendSrv';

import { notifyDataSourceCacheChanged } from './cacheGeneration';
import { createInstanceSettingsCache } from './instanceSettingsCache';
import { type DataSourceSettingsCacheProvider } from './settingsCacheProvider';

interface FrontendSettings {
  datasources: Record<string, DataSourceInstanceSettings>;
  defaultDatasource: string;
}

export function createConfigCacheProvider(
  settings: Record<string, DataSourceInstanceSettings>,
  defaultName: string
): DataSourceSettingsCacheProvider {
  const cache = createInstanceSettingsCache();

  function initialize(settings: Record<string, DataSourceInstanceSettings>, defaultName: string) {
    cache.initializeFromConfig(settings, defaultName);
    notifyDataSourceCacheChanged();
  }

  async function refreshList(): Promise<void> {
    const settings = await getBackendSrv().get<FrontendSettings>('/api/frontend/settings');
    initialize(settings.datasources, settings.defaultDatasource);
  }

  initialize(settings, defaultName);

  return {
    ...cache,
    source: 'config',
    waitUntilReady: async () => {},
    refreshList,
    refreshSettings: async (uid) => cache.getSettingsByUid(uid),
    sync: initialize,
  };
}
