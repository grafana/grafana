import { cloneDeep } from 'lodash';
import { useAsync } from 'react-use';

import { AppPluginConfig } from '@grafana/data';

import { config } from '../config';

export type AppPluginMetas = Record<string, AppPluginConfig>;

let apps: AppPluginMetas = {};
let appsPromise: Promise<void> | undefined = undefined;

function areAppsInitialized(): boolean {
  return Boolean(Object.keys(apps).length);
}

async function initPluginMetas(): Promise<void> {
  if (appsPromise) {
    return appsPromise;
  }

  appsPromise = new Promise((resolve) => {
    if (config.featureToggles.useMTPlugins) {
      // add loading app configs from MT API here
      apps = {};
      resolve();
      return;
    }

    // eslint-disable-next-line no-restricted-syntax
    apps = config.apps;
    resolve();
    return;
  });

  return appsPromise;
}

export async function getAppPluginMetas(): Promise<AppPluginConfig[]> {
  if (!areAppsInitialized()) {
    await initPluginMetas();
  }

  return Object.values(cloneDeep(apps));
}

export async function getAppPluginMeta(id: string): Promise<AppPluginConfig | undefined> {
  if (!areAppsInitialized()) {
    await initPluginMetas();
  }

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

export interface UseAppPluginMetasResult {
  isAppPluginMetasLoading: boolean;
  error: Error | undefined;
  apps: AppPluginConfig[];
}

export function useAppPluginMetas(filterByIds: string[] = []): UseAppPluginMetasResult {
  const { loading, error, value: apps = [] } = useAsync(getAppPluginMetas);
  const filtered = apps.filter((app) => filterByIds.includes(app.id));

  return { isAppPluginMetasLoading: loading, error, apps: filtered };
}

export interface UseAppPluginMetaResult {
  isAppPluginMetaLoading: boolean;
  error: Error | undefined;
  app: AppPluginConfig | undefined;
}

export function useAppPluginMeta(filterById: string): UseAppPluginMetaResult {
  const { loading, error, value: app } = useAsync(() => getAppPluginMeta(filterById));
  return { isAppPluginMetaLoading: loading, error, app };
}
