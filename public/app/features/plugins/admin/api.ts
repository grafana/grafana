import { getBackendSrv } from '@grafana/runtime';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { mergeLocalsAndRemotes, mergeLocalAndRemote } from './helpers';
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

export async function getCatalogPlugins(): Promise<CatalogPlugin[]> {
  const [localPlugins, remotePlugins] = await Promise.all([getLocalPlugins(), getRemotePlugins()]);

  return mergeLocalsAndRemotes(localPlugins, remotePlugins);
}

export async function getCatalogPlugin(id: string): Promise<CatalogPlugin> {
  const { local, remote } = await getPlugin(id);

  return mergeLocalAndRemote(local, remote);
}

export async function getPluginDetails(id: string): Promise<CatalogPluginDetails> {
  const localPlugins = await getLocalPlugins();
  const local = localPlugins.find((p) => p.id === id);
  const isInstalled = Boolean(local);
  const [remote, versions] = await Promise.all([getRemotePlugin(id, isInstalled), getPluginVersions(id)]);
  const dependencies = remote?.json?.dependencies;
  // Prepend semver range when we fallback to grafanaVersion (deprecated in favour of grafanaDependency)
  // otherwise plugins cannot be installed.
  const grafanaDependency = dependencies?.grafanaDependency
    ? dependencies?.grafanaDependency
    : dependencies?.grafanaVersion
    ? `>=${dependencies?.grafanaVersion}`
    : '';

  return {
    grafanaDependency,
    pluginDependencies: dependencies?.plugins || [],
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

async function getPluginVersions(id: string): Promise<Version[]> {
  try {
    const versions: { items: PluginVersion[] } = await getBackendSrv().get(
      `${GRAFANA_API_ROOT}/plugins/${id}/versions`
    );

    return (versions.items || []).map(({ version, createdAt }) => ({ version, createdAt }));
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

export async function installPlugin(id: string, version: string) {
  return await getBackendSrv().post(`${API_ROOT}/${id}/install`, {
    version,
  });
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
