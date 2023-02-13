import { LinkExtensionConfigurer } from '@grafana/data';

type PreloadPluginConfig = {
  error?: unknown;
  extensionConfigs?: Record<string, LinkExtensionConfigurer>;
};

const configs: Record<string, PreloadPluginConfig> = {};

export function setPreloadPluginConfig(id: string, config: PreloadPluginConfig) {
  configs[id] = config;
}

export function getPreloadPluginConfig(id: string): PreloadPluginConfig | undefined {
  return configs[id];
}
