import type { GrafanaConfig } from '@grafana/data';

let extensionsRegistry = {};

export function configurePluginExtensions(config: GrafanaConfig): void {
  // take what ever we need from the config and place it in the extensions registry so it can be used by other functions that we expose.
  extensionsRegistry = config.pluginExtensions;
}
