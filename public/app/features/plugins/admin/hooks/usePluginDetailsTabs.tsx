import { useMemo } from 'react';
import { PluginIncludeType, PluginType } from '@grafana/data';
import { CatalogPlugin, PluginDetailsTab } from '../types';
import { isOrgAdmin } from '../helpers';
import { usePluginConfig } from '../hooks/usePluginConfig';

export const usePluginDetailsTabs = (plugin?: CatalogPlugin, defaultTabs: PluginDetailsTab[] = []) => {
  const { loading, error, value: pluginConfig } = usePluginConfig(plugin);
  const tabs = useMemo(() => {
    const canConfigurePlugins = isOrgAdmin();
    const tabs: Array<{ label: string }> = [...defaultTabs];

    // Not extending the tabs with the config pages if the plugin is not installed
    if (!pluginConfig) {
      return tabs;
    }

    if (canConfigurePlugins) {
      if (pluginConfig.meta.type === PluginType.app) {
        if (pluginConfig.angularConfigCtrl) {
          tabs.push({
            label: 'Config',
          });
        }

        if (pluginConfig.configPages) {
          for (const page of pluginConfig.configPages) {
            tabs.push({
              label: page.title,
            });
          }
        }

        if (pluginConfig.meta.includes?.find((include) => include.type === PluginIncludeType.dashboard)) {
          tabs.push({
            label: 'Dashboards',
          });
        }
      }
    }

    return tabs;
  }, [pluginConfig, defaultTabs]);

  return {
    loading,
    tabs,
    error,
  };
};
