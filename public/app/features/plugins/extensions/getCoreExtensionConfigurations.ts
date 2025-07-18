import { PluginExtensionAddedLinkConfig } from '@grafana/data';
import { getDataSourceExtensionConfigs } from 'app/features/datasources/extensions/getDataSourceExtensionConfigs';
import { getExploreExtensionConfigs } from 'app/features/explore/extensions/getExploreExtensionConfigs';

export function getCoreExtensionConfigurations(): PluginExtensionAddedLinkConfig[] {
  return [
    ...getExploreExtensionConfigs(),
    ...getDataSourceExtensionConfigs(),
  ];
}
