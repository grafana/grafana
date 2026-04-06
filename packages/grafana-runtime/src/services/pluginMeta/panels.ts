import { PluginType, type PanelPluginMeta } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { getBackendSrv } from '../backendSrv';

import { FALLBACK_TO_BOOTDATA_WARNING } from './constants';
import { logPluginMetaWarning } from './logging';
import { getPanelPluginMapper } from './mappers/mappers';
import { initPluginMetas, refetchPluginMetas } from './plugins';
import type { PanelPluginMetas, PluginMetasResponse } from './types';

let panels: PanelPluginMetas = {};
let panelsByAliasIDs: PanelPluginMetas = {};

function initialized(): boolean {
  return Boolean(Object.keys(panels).length);
}

function resolveAliasIDs(panels: PanelPluginMetas): PanelPluginMetas {
  const keys = Object.keys(panels);
  const panelsByAliasIDs: PanelPluginMetas = {};

  for (let i = 0; i < keys.length; i++) {
    const pluginId = keys[i];
    const panel = panels[pluginId];
    const aliases = panel?.aliasIDs;

    if (!aliases?.length) {
      continue;
    }

    for (let j = 0; j < aliases.length; j++) {
      const alias = aliases[j];
      panelsByAliasIDs[alias] = panel;
    }
  }

  return panelsByAliasIDs;
}

function setPanelsAndAliases(input: PanelPluginMetas) {
  panels = input;
  panelsByAliasIDs = resolveAliasIDs(panels);
}

function setMetas(metas: PluginMetasResponse) {
  if (!metas.items.length) {
    // something failed while trying to fetch plugin meta
    // fallback to config.panels from bootdata
    // eslint-disable-next-line @grafana/no-config-panels
    setPanelsAndAliases(config.panels);
    logPluginMetaWarning(FALLBACK_TO_BOOTDATA_WARNING, PluginType.panel);
    return;
  }

  const mapper = getPanelPluginMapper();
  setPanelsAndAliases(mapper(metas));
}

async function initPanelPluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    // eslint-disable-next-line @grafana/no-config-panels
    setPanelsAndAliases(config.panels);
    return;
  }

  const metas = await initPluginMetas();
  setMetas(metas);
}

function getListedPanels(panels: PanelPluginMeta[]): PanelPluginMeta[] {
  return panels.filter((p) => p.hideFromList === false);
}

export async function getPanelPluginMetas(): Promise<PanelPluginMeta[]> {
  if (!initialized()) {
    await initPanelPluginMetas();
  }

  return Object.values(structuredClone(panels));
}

export async function getListedPanelPluginMetas(): Promise<PanelPluginMeta[]> {
  const panels = await getPanelPluginMetas();
  return getListedPanels(panels).sort((a, b) => a.sort - b.sort);
}

export async function getPanelPluginMetasMap(): Promise<PanelPluginMetas> {
  if (!initialized()) {
    await initPanelPluginMetas();
  }

  return structuredClone(panels);
}

/**
 * Get a map of panel plugins keyed by plugin id.
 * This is a synchronous function that should only be used as an escape hatch in cases where the caller is guaranteed to be called after the panel plugins have been initialized.
 * In other cases, getPanelPluginMetasMap() should be used instead to ensure the panel plugins have been initialized before accessing them.
 * @throws Error if the panel plugins have not been initialized yet
 * @returns a map of panel plugins keyed by plugin id
 */
export function getPanelPluginMetasMapSync(): PanelPluginMetas {
  if (!initialized() && process.env.NODE_ENV === 'development') {
    throw new Error('getPanelPluginMetasMapSync() was called before panel plugins map was initialized!');
  }
  return structuredClone(panels);
}

export async function getPanelPluginMeta(pluginId: string): Promise<PanelPluginMeta | null> {
  if (!initialized()) {
    await initPanelPluginMetas();
  }

  const panel = panels[pluginId];
  if (panel) {
    return structuredClone(panel);
  }

  // Check alias values before failing
  const aliased = panelsByAliasIDs[pluginId];
  if (aliased) {
    return structuredClone(aliased);
  }

  return null;
}

/**
 * Check if a panel plugin is installed.
 * @param pluginId - The id of the panel plugin.
 * @returns True if the panel plugin is installed, false otherwise.
 */
export async function isPanelPluginInstalled(pluginId: string): Promise<boolean> {
  const panel = await getPanelPluginMeta(pluginId);
  return Boolean(panel);
}

/**
 * Get the version of a panel plugin.
 * @param pluginId - The id of the panel plugin.
 * @returns The version of the panel plugin, or null if the plugin is not installed.
 */
export async function getPanelPluginVersion(pluginId: string): Promise<string | null> {
  const panel = await getPanelPluginMeta(pluginId);
  return panel?.info.version ?? null;
}

/**
 * Get a list of panel plugin ids that are not hidden from list
 * @returns an array of panel plugin ids that are not hidden from list
 */
export async function getListedPanelPluginIds(): Promise<string[]> {
  const panels = await getPanelPluginMetas();
  return getListedPanels(panels).map((p) => p.id);
}

export function setPanelPluginMetas(override: PanelPluginMetas): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setPanelPluginMetas() function can only be called from tests.');
  }

  setPanelsAndAliases(structuredClone(override));
}

export async function refetchPanelPluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    const settings = await getBackendSrv().get('/api/frontend/settings');
    setPanelsAndAliases(settings.panels);
    return;
  }

  const metas = await refetchPluginMetas();
  setMetas(metas);
}
