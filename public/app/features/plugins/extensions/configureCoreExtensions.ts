import { PluginExtensionTypes, type PluginExtensionLinkConfig } from '@grafana/data';
import { getExploreExtensions } from 'app/features/explore/extensions/getExploreExtensions';

import { PluginPreloadResult } from '../pluginPreloader';

export function configureCoreExtensions(results: PluginPreloadResult[]): PluginPreloadResult[] {
  const coreExtensions: PluginPreloadResult = {
    pluginId: 'grafana',
    extensionConfigs: getCorePluginExtensions(),
  };

  return [coreExtensions, ...results];
}

export function createExtensionLinkConfig<T extends object>(
  config: Omit<PluginExtensionLinkConfig<T>, 'type'>
): PluginExtensionLinkConfig {
  const linkConfig = {
    type: PluginExtensionTypes.link,
    ...config,
  };
  assertIsLinkConfig(linkConfig);
  return linkConfig;
}

function getCorePluginExtensions(): PluginExtensionLinkConfig[] {
  return [...getExploreExtensions()];
}

function assertIsLinkConfig<T extends object>(
  config: PluginExtensionLinkConfig<T>
): asserts config is PluginExtensionLinkConfig {
  if (config.type !== PluginExtensionTypes.link) {
    throw Error('value is not a string');
  }
}
