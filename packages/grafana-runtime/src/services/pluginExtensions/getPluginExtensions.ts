import { PluginExtension } from '@grafana/data';

export type GetPluginExtensions = ({
  extensionPointId,
  context,
}: {
  extensionPointId: string;
  context?: object | Record<string | symbol, unknown>;
}) => {
  extensions: PluginExtension[];
};

let singleton: GetPluginExtensions | undefined;

export function setPluginExtensionGetter(instance: GetPluginExtensions): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginExtensionGetter() function should only be called once, when Grafana is starting.');
  }
  singleton = instance;
}

function getPluginExtensionGetter(): GetPluginExtensions {
  if (!singleton) {
    throw new Error('getPluginExtensionGetter() can only be used after the Grafana instance has started.');
  }
  return singleton;
}

export const getPluginExtensions: GetPluginExtensions = (options) => getPluginExtensionGetter()(options);
