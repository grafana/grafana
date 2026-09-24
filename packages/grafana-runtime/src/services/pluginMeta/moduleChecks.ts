import { type PluginType } from '@grafana/data';

import { logPluginMetaError, logPluginMetaWarning } from './logging';

export enum PluginMetaSource {
  bootdata = 'bootdata',
  metas = 'metas',
}

const LOADABLE_MODULE_PREFIXES = ['http://', 'https://', 'core:', 'public/plugins/', 'public/app/plugins/'] as const;

type ErrorLogger = typeof logPluginMetaError;
type WarningLogger = typeof logPluginMetaWarning;

export function isLoadableModule(module: string | undefined): module is string {
  return typeof module === 'string' && LOADABLE_MODULE_PREFIXES.some((prefix) => module.startsWith(prefix));
}

export function hasModuleMetaAgreement(metasModule: string | undefined, bootDataModule: string | undefined): boolean {
  return bootDataModule === metasModule;
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

export function logMetasDisagreementsWithBootData<T, U>(
  metasInput: Record<string, T>,
  bootDataInput: Record<string, U>,
  pluginType: PluginType,
  getMetasModule: (entry: T) => string | undefined,
  getBootDataModule: (entry: U) => string | undefined,
  logWarning: WarningLogger = logPluginMetaWarning
): void {
  const disagreements: string[] = [];
  for (const [pluginId, entry] of Object.entries(metasInput)) {
    const metasModule = getMetasModule(entry);
    const bootDataEntry = bootDataInput[pluginId];
    const bootDataModule = bootDataEntry ? getBootDataModule(bootDataEntry) : undefined;
    if (hasModuleMetaAgreement(metasModule, bootDataModule)) {
      continue;
    }
    disagreements.push(pluginId);
  }
  if (disagreements.length === 0) {
    return;
  }
  logWarning('PluginMeta: bootdata/metas module disagreements', {
    pluginType,
    count: String(disagreements.length),
    total: String(Object.keys(metasInput).length),
    pluginIds: disagreements.join(','),
  });
}
