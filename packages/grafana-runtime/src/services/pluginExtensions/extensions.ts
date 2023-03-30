import { type PluginExtension } from '@grafana/data';

import { config } from '../../config';

import { getPluginsExtensionRegistry } from './registry';

export type PluginExtensionsOptions<T extends object> = {
  placement: string;
  context?: T;
  testData?: PluginExtension[];
};

export type PluginExtensionsResult = {
  extensions: PluginExtension[];
};

export function getPluginExtensions<T extends object = {}>(
  options: PluginExtensionsOptions<T>
): PluginExtensionsResult {
  const { placement, context, testData } = options;
  const registry = getPluginsExtensionRegistry();
  const configureFuncs = registry[placement] ?? [];

  if (configuredToRunAsTest(placement)) {
    console.log(`[PluginExtensions] running ${placement} in test mode.`, { testData });
    return {
      extensions: testData ?? [],
    };
  }

  const extensions = configureFuncs.reduce<PluginExtension[]>((result, configure) => {
    const extension = configure(context);

    // If the configure() function returns `undefined`, the extension is not displayed
    if (extension) {
      result.push(extension);
    }

    return result;
  }, []);

  return {
    extensions: extensions,
  };
}

let pointIdTestCache: Record<string, boolean> | undefined;

function configuredToRunAsTest(placement: string): boolean {
  if (!pointIdTestCache) {
    pointIdTestCache = config.pluginExtensionsTestEnabled.reduce((cache: Record<string, boolean>, pointId) => {
      if (!cache) {
        cache = {};
      }
      cache[pointId] = true;
      return cache;
    }, {});
  }

  return Boolean(pointIdTestCache[placement]);
}
