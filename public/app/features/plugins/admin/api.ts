import { getBackendSrv } from '@grafana/runtime';
import { PluginError, renderMarkdown } from '@grafana/data';
import { API_ROOT, GCOM_API_ROOT } from './constants';
import { mergeLocalAndRemote } from './helpers';
import {
  PluginDetails,
  Org,
  LocalPlugin,
  RemotePlugin,
  CatalogPlugin,
  CatalogPluginDetails,
  Version,
  PluginVersion,
} from './types';

export async function getCatalogPlugin(id: string): Promise<CatalogPlugin> {
  const { local, remote } = await getPlugin(id);

  return mergeLocalAndRemote(local, remote);
}

export async function getPluginDetails(id: string): Promise<CatalogPluginDetails> {
  const localPlugins = await getLocalPlugins();
  const local = localPlugins.find((p) => p.id === id);
  const isInstalled = Boolean(local);
  const [remote, versions, localReadme] = await Promise.all([
    getRemotePlugin(id, isInstalled),
    getPluginVersions(id),
    getLocalPluginReadme(id),
  ]);
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
  const res = await getBackendSrv().get(`${GCOM_API_ROOT}/plugins`);
  return res.items;
}

async function getPlugin(slug: string): Promise<PluginDetails> {
  const installed = await getLocalPlugins();

  const localPlugin = installed?.find((plugin: LocalPlugin) => {
    return plugin.id === slug;
  });

  const [remote, versions] = await Promise.all([getRemotePlugin(slug, Boolean(localPlugin)), getPluginVersions(slug)]);

  return {
    remote: remote,
    remoteVersions: versions,
    local: localPlugin,
  };
}

export async function getPluginErrors(): Promise<PluginError[]> {
  try {
    return await getBackendSrv().get(`${API_ROOT}/errors`);
  } catch (error) {
    return [];
  }
}

async function getRemotePlugin(id: string, isInstalled: boolean): Promise<RemotePlugin | undefined> {
  try {
    return await getBackendSrv().get(`${GCOM_API_ROOT}/plugins/${id}`, {});
  } catch (error) {
    // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
    error.isHandled = true;
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
    // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
    error.isHandled = true;
    return [];
  }
}

async function getLocalPluginReadme(id: string): Promise<string> {
  try {
    const markdown: string = await getBackendSrv().get(`${API_ROOT}/${id}/markdown/help`);
    const markdownAsHtml = markdown ? renderMarkdown(markdown) : '';

    return markdownAsHtml;
  } catch (error) {
    error.isHandled = true;
    return '';
  }
}

export async function getLocalPlugins(): Promise<LocalPlugin[]> {
  const installed = await getBackendSrv().get(`${API_ROOT}`, { embedded: 0 });
  return installed;
}

async function getOrg(slug: string): Promise<Org> {
  const org = await getBackendSrv().get(`${GCOM_API_ROOT}/orgs/${slug}`);
  return { ...org, avatarUrl: `${GCOM_API_ROOT}/orgs/${slug}/avatar` };
}

export async function installPlugin(id: string) {
  // This will install the latest compatible version based on the logic
  // on the backend.
  return await getBackendSrv().post(`${API_ROOT}/${id}/install`);
}

export async function uninstallPlugin(id: string) {
  return await getBackendSrv().post(`${API_ROOT}/${id}/uninstall`);
}

export const api = {
  getRemotePlugins,
  getPlugin,
  getInstalledPlugins: getLocalPlugins,
  getOrg,
  installPlugin,
  uninstallPlugin,
};
