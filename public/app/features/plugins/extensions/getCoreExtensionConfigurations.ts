import { type PluginExtensionLinkConfig } from '@grafana/data';
import { getExploreExtensionConfigs } from 'app/features/explore/extensions/getExploreExtensionConfigs';

export function getCoreExtensionConfigurations(): PluginExtensionLinkConfig[] {
  return [...getExploreExtensionConfigs()];
}
