import { type PluginType } from '@grafana/data';

import { logPluginMetaError, logPluginMetaWarning } from './logging';

export enum PluginMetaSource {
  bootdata = 'bootdata',
  metas = 'metas',
}

const LOADABLE_MODULE_PREFIXES = ['http://', 'https://', 'core:'] as const;

type ErrorLogger = typeof logPluginMetaError;
type WarningLogger = typeof logPluginMetaWarning;

export function isLoadableModule(module: string | undefined): module is string {
  return typeof module === 'string' && LOADABLE_MODULE_PREFIXES.some((prefix) => module.startsWith(prefix));
}

export function hasModuleMetaAgreement(metasModule: string | undefined, bootDataModule: string | undefined): boolean {
  return !bootDataModule || bootDataModule === metasModule;
}

export function logUnloadableModules<T>(
  input: Record<string, T>,
  source: PluginMetaSource,
  pluginType: PluginType,
  getModule: (entry: T) => string | undefined,
  logError: ErrorLogger = logPluginMetaError
): void {
  for (const [pluginId, entry] of Object.entries(input)) {
    const module = getModule(entry);
    if (isLoadableModule(module)) {
      continue;
    }
    logError('PluginMeta: unloadable module path', undefined, {
      pluginId,
      pluginType,
      module: module ?? '',
      source,
    });
  }
}

export function logMetasDisagreementsWithBootData<T, U>(
  metasInput: Record<string, T>,
  bootDataInput: Record<string, U>,
  pluginType: PluginType,
  getMetasModule: (entry: T) => string | undefined,
  getBootDataModule: (entry: U) => string | undefined,
  logWarning: WarningLogger = logPluginMetaWarning
): void {
  for (const [pluginId, entry] of Object.entries(metasInput)) {
    const metasModule = getMetasModule(entry);
    const bootDataEntry = bootDataInput[pluginId];
    const bootDataModule = bootDataEntry ? getBootDataModule(bootDataEntry) : undefined;
    if (hasModuleMetaAgreement(metasModule, bootDataModule)) {
      continue;
    }
    logWarning('PluginMeta: bootdata/metas module disagreement', {
      pluginId,
      pluginType,
      bootDataModule: bootDataModule ?? '',
      metasModule: metasModule ?? '',
    });
  }
}
