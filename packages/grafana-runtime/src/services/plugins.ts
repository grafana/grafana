import { cloneDeep } from 'lodash';

import { AppPluginConfig } from '@grafana/data';

import { config } from '../config';

export type AppPluginMetas = Record<string, AppPluginConfig>;

let apps: AppPluginMetas = {};

export async function initPluginMetas(): Promise<void> {
  if (config.featureToggles.useMTPlugins) {
    // add loading app configs from MT API here
    apps = {};
    return;
  }

  // eslint-disable-next-line no-restricted-syntax
  apps = config.apps;
}

export function getAppPluginMetas(): AppPluginMetas {
  return cloneDeep(apps);
}

export function getAppPluginMeta(id: string): AppPluginConfig | undefined {
  if (!apps[id]) {
    return undefined;
  }

  return cloneDeep(apps[id]);
}

export function setAppPluginMetas(override: AppPluginMetas) {
  // We allow overriding apps in tests
  if (override && process.env.NODE_ENV !== 'test') {
    throw new Error('setAppPluginMetas() function can only be called from tests.');
  }

  apps = { ...override };
}
