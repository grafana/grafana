import { type PluginExtensionLinkConfig } from '@grafana/data';
import { getExploreExtensions } from 'app/features/explore/extensions/getExploreExtensions';

import { PluginPreloadResult } from '../pluginPreloader';

export function configureCoreExtensions(results: PluginPreloadResult[]): PluginPreloadResult[] {
  const coreExtensions: PluginPreloadResult = {
    pluginId: 'grafana',
    extensionConfigs: getCorePluginExtensions(),
  };

  return [coreExtensions, ...results];
}

function getCorePluginExtensions(): PluginExtensionLinkConfig[] {
  return [...getExploreExtensions()];
}
