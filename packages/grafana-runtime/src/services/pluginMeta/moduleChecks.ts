import { type PluginType } from '@grafana/data';

import { logPluginMetaError } from './logging';

export enum PluginMetaSource {
  bootdata = 'bootdata',
  metas = 'metas',
}

const LOADABLE_MODULE_PREFIXES = ['http://', 'https://', 'core:', 'public/plugins/', 'public/app/plugins/'] as const;

type ErrorLogger = typeof logPluginMetaError;

export function isLoadableModule(module: string | undefined): module is string {
  return typeof module === 'string' && LOADABLE_MODULE_PREFIXES.some((prefix) => module.startsWith(prefix));
}

export function logUnloadableModules<T>(
  input: Record<string, T>,
  source: PluginMetaSource,
  pluginType: PluginType,
  getModule: (entry: T) => string | undefined,
  logError: ErrorLogger = logPluginMetaError
): void {
  const unloadable: string[] = [];
  for (const [pluginId, entry] of Object.entries(input)) {
    if (isLoadableModule(getModule(entry))) {
      continue;
    }
    unloadable.push(pluginId);
  }
  if (unloadable.length === 0) {
    return;
  }
  logError('PluginMeta: unloadable module paths', undefined, {
    pluginType,
    source,
    count: String(unloadable.length),
    total: String(Object.keys(input).length),
    pluginIds: unloadable.join(','),
  });
}
