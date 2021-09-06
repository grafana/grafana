import { getBackendSrv } from '@grafana/runtime';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { PluginDetails, Org, LocalPlugin, RemotePlugin, CatalogPlugin, CatalogPluginDetails } from './types';
import { mergeLocalsAndRemotes, mergeLocalAndRemote } from './helpers';

export async function getCatalogPlugins(): Promise<CatalogPlugin[]> {
  const localPlugins = await getLocalPlugins();
  const remotePlugins = await getRemotePlugins();

  return mergeLocalsAndRemotes(localPlugins, remotePlugins);
}

export async function getCatalogPlugin(id: string): Promise<CatalogPlugin> {
  const { local, remote } = await getPlugin(id);

  return mergeLocalAndRemote(local, remote);
}

export async function getPluginDetails(id: string): Promise<CatalogPluginDetails> {
  const localPlugins = await getLocalPlugins(); // /api/plugins/<id>/settings
  const local = localPlugins.find((p) => p.id === id);
  const isInstalled = Boolean(local);
  const [remote, versions] = await Promise.all([getRemotePlugin(id, isInstalled), getPluginVersions(id)]);

  return {
    grafanaDependency: remote?.json?.dependencies?.grafanaDependency || '',
    links: remote?.json?.info.links || local?.info.links || [],
    readme: remote?.readme,
    versions,
  };
}

async function getRemotePlugins(): Promise<RemotePlugin[]> {
  const res = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins`);
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

async function getRemotePlugin(id: string, isInstalled: boolean): Promise<RemotePlugin | undefined> {
  try {
    return await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins/${id}`);
  } catch (error) {
    // this might be a plugin that doesn't exist on gcom.
    error.isHandled = isInstalled;
    return;
  }
}

async function getPluginVersions(id: string): Promise<any[]> {
  try {
    const versions = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins/${id}/versions`);
    return versions.items;
  } catch (error) {
    return [];
  }
}

async function getLocalPlugins(): Promise<LocalPlugin[]> {
  const installed = await getBackendSrv().get(`${API_ROOT}`, { embedded: 0 });
  return installed;
}

async function getOrg(slug: string): Promise<Org> {
  const org = await getBackendSrv().get(`${GRAFANA_API_ROOT}/orgs/${slug}`);
  return { ...org, avatarUrl: `${GRAFANA_API_ROOT}/orgs/${slug}/avatar` };
}

async function installPlugin(id: string, version: string) {
  return await getBackendSrv().post(`${API_ROOT}/${id}/install`, {
    version,
  });
}

async function uninstallPlugin(id: string) {
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
