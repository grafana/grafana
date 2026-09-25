import { type PanelPluginMeta, PluginType } from '@grafana/data';

import { logPluginMetaWarning } from './logging';

type WarningLogger = typeof logPluginMetaWarning;

function normalizePanelModulePath(module: string | undefined): string {
  const PUBLIC_URL_SEGMENT = '/public/';
  const PUBLIC_PREFIX = 'public/';
  if (!module) {
    return '';
  }
  const urlIdx = module.lastIndexOf(PUBLIC_URL_SEGMENT);
  if (urlIdx !== -1) {
    return module.slice(urlIdx + PUBLIC_URL_SEGMENT.length);
  }
  if (module.startsWith(PUBLIC_PREFIX)) {
    return module.slice(PUBLIC_PREFIX.length);
  }
  return module;
}

export function hasPanelModuleMetaAgreement(
  metasModule: string | undefined,
  bootDataModule: string | undefined
): boolean {
  return normalizePanelModulePath(metasModule) === normalizePanelModulePath(bootDataModule);
}

export function logPanelMetasDisagreementsWithBootData(
  metasInput: Record<string, PanelPluginMeta>,
  bootDataInput: Record<string, PanelPluginMeta>,
  logWarning: WarningLogger = logPluginMetaWarning
): void {
  const disagreements: string[] = [];
  for (const [pluginId, entry] of Object.entries(metasInput)) {
    const metasModule = entry?.module;
    const bootDataEntry = bootDataInput[pluginId];
    const bootDataModule = bootDataEntry?.module;
    if (hasPanelModuleMetaAgreement(metasModule, bootDataModule)) {
      continue;
    }
    disagreements.push(pluginId);
  }
  if (disagreements.length === 0) {
    return;
  }
  logWarning('PluginMeta: bootdata/metas panel module disagreements', {
    pluginType: PluginType.panel,
    count: String(disagreements.length),
    total: String(Object.keys(metasInput).length),
    pluginIds: disagreements.join(','),
  });
}
