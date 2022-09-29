import { PluginError, PluginMeta, renderMarkdown } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';

import { API_ROOT, GCOM_API_ROOT } from './constants';
import { isLocalPluginVisible, isRemotePluginVisible } from './helpers';
import { LocalPlugin, RemotePlugin, CatalogPluginDetails, Version, PluginVersion } from './types';

export async function getPluginDetails(id: string): Promise<CatalogPluginDetails> {
  const remote = await getRemotePlugin(id);
  const isPublished = Boolean(remote);

  const [localPlugins, versions, localReadme] = await Promise.all([
    getLocalPlugins(),
    getPluginVersions(id, isPublished),
    getLocalPluginReadme(id),
  ]);

  const local = localPlugins.find((p) => p.id === id);
  const dependencies = local?.dependencies || remote?.json?.dependencies;

  return {
    grafanaDependency: dependencies?.grafanaDependency ?? dependencies?.grafanaVersion ?? '',
    pluginDependencies: dependencies?.plugins || [],
    links: local?.info.links || remote?.json?.info.links || [],
    readme: localReadme || remote?.readme,
    versions,
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

async function getPluginVersions(id: string, isPublished: boolean): Promise<Version[]> {
  try {
    if (!isPublished) {
      return [];
    }

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
  const localPlugins: LocalPlugin[] = await getBackendSrv().get(
    `${API_ROOT}`,
    accessControlQueryParam({ embedded: 0 })
  );

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
