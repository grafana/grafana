import { PluginAddedLinkConfig } from '@grafana/data';
import { getExploreExtensionConfigs } from 'app/features/explore/extensions/getExploreExtensionConfigs';

export function getCoreExtensionConfigurations(): PluginAddedLinkConfig[] {
  return [...getExploreExtensionConfigs()];
}
