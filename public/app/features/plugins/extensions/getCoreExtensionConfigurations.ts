import { type PluginExtensionLinkConfig } from '@grafana/data';
import { getExploreAddedLinks } from 'app/features/explore/extensions/getExploreExtensionConfigs';

export function getCoreAddedLinks(): PluginExtensionLinkConfig[] {
  return [...getExploreAddedLinks()];
}
