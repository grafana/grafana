import type { PanelPluginMeta } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { getBackendSrv } from '../backendSrv';

import { getPanelPluginMapper } from './mappers/mappers';
import { initPluginMetas, refetchPluginMetas } from './plugins';
import type { PanelPluginMetas } from './types';

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

async function initPanelPluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    // eslint-disable-next-line no-restricted-syntax
    panels = config.panels;
    panelsByAliasIDs = resolveAliasIDs(panels);
    return;
  }

  const metas = await initPluginMetas();
  const mapper = getPanelPluginMapper();
  panels = mapper(metas);
  panelsByAliasIDs = resolveAliasIDs(panels);
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

  panels = structuredClone(override);
  panelsByAliasIDs = resolveAliasIDs(panels);
}

export async function refetchPanelPluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    const settings = await getBackendSrv().get('/api/frontend/settings');
    panels = settings.panels;
    panelsByAliasIDs = resolveAliasIDs(panels);

    // TODO(@hugohaggmark) remove this as soon as all config.panels occurances have been replaced in core Grafana
    // eslint-disable-next-line no-restricted-syntax
    config.panels = settings.panels;
    return;
  }

  const metas = await refetchPluginMetas();
  const mapper = getPanelPluginMapper();
  panels = mapper(metas);
  panelsByAliasIDs = resolveAliasIDs(panels);
}
