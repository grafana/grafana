import { PluginError, PluginMeta, renderMarkdown } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';

import { API_ROOT, GCOM_API_ROOT } from '../constants';
import { LocalPlugin, RemotePlugin, Version, PluginVersion, CatalogPlugin } from '../types';

import {
  isLocalPluginVisible,
  isRemotePluginVisible,
  mapLocalToCatalog,
  mapRemoteToCatalog,
  mergeLocalAndRemote,
} from './helpers';

// We are fetching these details separately as they are currently not part of the list responses (either locally or on the remote).
// (Ideally all of these could be moved to the list responses, except the versions)
export async function getPluginDetails(id: string): Promise<CatalogPlugin> {
  const [local, remote, versions, localReadme] = await Promise.all([
    getLocalPlugin(id),
    getRemotePlugin(id),
    getPluginVersions(id),
    getLocalPluginReadme(id),
  ]);

  let plugin: CatalogPlugin;

  if (local && remote) {
    plugin = mergeLocalAndRemote(local, remote);
  } else if (local) {
    plugin = mapLocalToCatalog(local);
  } else if (remote) {
    plugin = mapRemoteToCatalog(remote);
  } else {
    throw new Error(`No local or remote version of the plugin was found ("${id}")`);
  }

  const dependencies = local?.dependencies || remote?.json?.dependencies;

  return {
    ...plugin,
    readme: localReadme || remote?.readme,
    grafanaDependency: dependencies?.grafanaDependency ?? dependencies?.grafanaVersion ?? '',
    pluginDependencies: dependencies?.plugins || [],
    links: local?.info.links || remote?.json?.info.links || [],

    info: {
      ...plugin.info,
      versions,
    },

    settings: {
      ...plugin.settings,
      module: local?.module,
      baseUrl: local?.baseUrl,
    },
  };
}

export async function getRemotePlugins(): Promise<RemotePlugin[]> {
  const { items: remotePlugins }: { items: RemotePlugin[] } = await getBackendSrv().get(`${GCOM_API_ROOT}/plugins`);

  return remotePlugins.filter(isRemotePluginVisible);
}

export async function getPluginErrors(): Promise<PluginError[]> {
  try {
    return await getBackendSrv().get(`${API_ROOT}/errors`);
  } catch (error) {
    return [];
  }
}

async function getRemotePlugin(id: string): Promise<RemotePlugin | undefined> {
  try {
    return await getBackendSrv().get(`${GCOM_API_ROOT}/plugins/${id}`, {});
  } catch (error) {
    if (isFetchError(error)) {
      // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
      error.isHandled = true;
    }
    return;
  }
}

async function getLocalPlugin(id: string): Promise<LocalPlugin | undefined> {
  try {
    return await getBackendSrv().get(`${API_ROOT}/${id}/settings`, {});
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return;
  }
}

async function getPluginVersions(id: string): Promise<Version[]> {
  try {
    const versions: { items: PluginVersion[] } = await getBackendSrv().get(`${GCOM_API_ROOT}/plugins/${id}/versions`);

    return (versions.items || []).map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      isCompatible: v.isCompatible,
      grafanaDependency: v.grafanaDependency,
    }));
  } catch (error) {
    if (isFetchError(error)) {
      // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
      error.isHandled = true;
    }
    return [];
  }
}

async function getLocalPluginReadme(id: string): Promise<string> {
  try {
    const markdown: string = await getBackendSrv().get(`${API_ROOT}/${id}/markdown/help`);
    const markdownAsHtml = markdown ? renderMarkdown(markdown) : '';

    return markdownAsHtml;
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return '';
  }
}

export async function getLocalPlugins(): Promise<LocalPlugin[]> {
  const localPlugins: LocalPlugin[] = await getBackendSrv().get(`${API_ROOT}`, { embedded: 0 });

  return localPlugins.filter(isLocalPluginVisible);
}

export async function installPlugin(id: string) {
  // This will install the latest compatible version based on the logic
  // on the backend.
  return await getBackendSrv().post(`${API_ROOT}/${id}/install`);
}

export async function uninstallPlugin(id: string) {
  return await getBackendSrv().post(`${API_ROOT}/${id}/uninstall`);
}

export async function updatePluginSettings(id: string, data: Partial<PluginMeta>) {
  const response = await getBackendSrv().datasourceRequest({
    url: `/api/plugins/${id}/settings`,
    method: 'POST',
    data,
  });

  return response?.data;
}

export const api = {
  getRemotePlugins,
  getInstalledPlugins: getLocalPlugins,
  installPlugin,
  uninstallPlugin,
};
