import { type PanelPluginMeta, PluginType } from '@grafana/data';

import { logPluginMetaWarning } from './logging';

type WarningLogger = typeof logPluginMetaWarning;

function getPublicPath(): string {
  return typeof window !== 'undefined' && window.__grafana_public_path__ ? window.__grafana_public_path__ : '';
}

function normalizeEnd(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Strips a leading public-path prefix from a module path so that metas-side
 * module strings (which the metas mapper rewrites via `prependPublicPathToCorePlugins`
 * for decoupled core plugins) can be compared against bootdata-side raw module paths.
 */
export function normalizePanelModulePath(module: string | undefined): string | undefined {
  if (!module) {
    return module;
  }
  const publicPath = getPublicPath();
  if (!publicPath) {
    return module;
  }
  const prefix = normalizeEnd(publicPath);
  return module.startsWith(prefix) ? module.slice(prefix.length) : module;
}

export function hasPanelModuleMetaAgreement(
  metasModule: string | undefined,
  bootDataModule: string | undefined
): boolean {
  return normalizePanelModulePath(bootDataModule) === normalizePanelModulePath(metasModule);
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
