import { getBackendSrv } from '@grafana/runtime';
import { PluginMeta } from '@grafana/data';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { Plugin, PluginDetails, Org, LocalPlugin } from './types';

async function getRemotePlugins(): Promise<Plugin[]> {
  const res = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins`);
  return res.items;
}

async function getPlugin(slug: string): Promise<PluginDetails> {
  const installed = await getInstalledPlugins();

  const localPlugin = installed?.find((plugin: LocalPlugin) => {
    return plugin.id === slug;
  });

  const [remote, versions] = await Promise.all([getRemotePlugin(slug, localPlugin), getPluginVersions(slug)]);

  return {
    remote: remote,
    remoteVersions: versions,
    local: localPlugin,
  };
}

async function getRemotePlugin(slug: string, local: LocalPlugin | undefined): Promise<Plugin | undefined> {
  try {
    return await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins/${slug}`);
  } catch (error) {
    // this might be a plugin that doesn't exist on gcom.
    error.isHandled = !!local;
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

async function getInstalledPlugins(): Promise<any> {
  const installed = await getBackendSrv().get(`${API_ROOT}`);
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

async function updatePlugin(pluginId: string, data: Partial<PluginMeta>) {
  const response = await getBackendSrv().datasourceRequest({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  return response?.data;
}

export const api = {
  getRemotePlugins,
  getPlugin,
  getInstalledPlugins,
  getOrg,
  installPlugin,
  uninstallPlugin,
  updatePlugin,
};
