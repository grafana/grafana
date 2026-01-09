import type { AppPluginConfig } from '@grafana/data';

import { config } from '../../config';
import { evaluateBooleanFlag } from '../../internal/openFeature';

import { getAppPluginMapper } from './mappers/mappers';
import { initPluginMetas } from './plugins';
import type { AppPluginMetas } from './types';

let apps: AppPluginMetas = {};

function initialized(): boolean {
  return Boolean(Object.keys(apps).length);
}

async function initAppPluginMetas(): Promise<void> {
  if (!evaluateBooleanFlag('useMTPlugins', false)) {
    // eslint-disable-next-line no-restricted-syntax
    apps = config.apps;
    return;
  }

  const metas = await initPluginMetas();
  const mapper = getAppPluginMapper();
  apps = mapper(metas);
}

export async function getAppPluginMetas(): Promise<AppPluginConfig[]> {
  if (!initialized()) {
    await initAppPluginMetas();
  }

  return Object.values(structuredClone(apps));
}

export async function getAppPluginMeta(pluginId: string): Promise<AppPluginConfig | null> {
  if (!initialized()) {
    await initAppPluginMetas();
  }

  const app = apps[pluginId];
  return app ? structuredClone(app) : null;
}

/**
 * Check if an app plugin is installed.
 * @param pluginId - The id of the app plugin.
 * @returns True if the app plugin is installed, false otherwise.
 */
export async function isAppPluginInstalled(pluginId: string): Promise<boolean> {
  const app = await getAppPluginMeta(pluginId);
  return Boolean(app);
}

/**
 * Get the version of an app plugin.
 * @param pluginId - The id of the app plugin.
 * @returns The version of the app plugin, or null if the plugin is not installed.
 */
export async function getAppPluginVersion(pluginId: string): Promise<string | null> {
  const app = await getAppPluginMeta(pluginId);
  return app?.version ?? null;
}

export function setAppPluginMetas(override: AppPluginMetas): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setAppPluginMetas() function can only be called from tests.');
  }

  apps = structuredClone(override);
}
