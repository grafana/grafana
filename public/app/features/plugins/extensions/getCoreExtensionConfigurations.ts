import { PluginExtensionAddedLinkConfig } from '@grafana/data';
import { getExploreExtensionConfigs } from 'app/features/explore/extensions/getExploreExtensionConfigs';

export function getCoreExtensionConfigurations(): PluginExtensionAddedLinkConfig[] {
  return [...getExploreExtensionConfigs()];
}
