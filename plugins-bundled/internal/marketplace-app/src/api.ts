import { getBackendSrv } from '@grafana/runtime';
import { PluginMeta } from '@grafana/data';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { Plugin, PluginDetails, Org } from './types';

async function getRemotePlugins(): Promise<Plugin[]> {
  const res = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins`);
  return res.items;
}

async function getPlugin(slug: string): Promise<PluginDetails> {
  const res = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins/${slug}`);

  const versions = await getPluginVersions(slug);
  const installed = await getInstalledPlugins();

  const plugin = installed?.find((_: any) => {
    return _.id === slug;
  });

  return {
    remote: res,
    remoteVersions: versions,
    local: plugin,
  };
}

async function getPluginVersions(id: string): Promise<any[]> {
  const versions = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins/${id}/versions`);
  return versions.items;
}

async function getInstalledPlugins(): Promise<any> {
  const installed = await getBackendSrv().get(`${API_ROOT}?core=0`);
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
