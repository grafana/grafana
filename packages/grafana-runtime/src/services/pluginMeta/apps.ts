import { cloneDeep } from 'lodash';

import type { AppPluginConfig } from '@grafana/data';

import { config } from '../../config';

import { getAppPluginMapper } from './mappers/mappers';
import { initPluginMetas } from './plugins';
import type { AppPluginMetas } from './types';

let apps: AppPluginMetas = {};

function intialized(): boolean {
  return Boolean(Object.keys(apps).length);
}

async function initAppPluginMetas(): Promise<void> {
  if (!config.featureToggles.useMTPlugins) {
    // eslint-disable-next-line no-restricted-syntax
    apps = config.apps;
    return;
  }

  const metas = await initPluginMetas();
  const mapper = getAppPluginMapper();
  apps = mapper(metas);
}

export async function getAppPluginMetas(): Promise<AppPluginConfig[]> {
  if (!intialized()) {
    await initAppPluginMetas();
  }

  return Object.values(cloneDeep(apps));
}

export async function getAppPluginMeta(pluginId: string): Promise<AppPluginConfig | null> {
  if (!intialized()) {
    await initAppPluginMetas();
  }

  const app = apps[pluginId];
  return app ? cloneDeep(app) : null;
}

export async function isAppPluginInstalled(pluginId: string): Promise<boolean> {
  const app = await getAppPluginMeta(pluginId);
  return Boolean(app);
}

export async function getAppPluginVersion(pluginId: string): Promise<string | null> {
  const app = await getAppPluginMeta(pluginId);
  return app?.version ?? null;
}

export function setAppPluginMetas(override: AppPluginMetas): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setAppPluginMetas() function can only be called from tests.');
  }

  apps = cloneDeep(override);
}
