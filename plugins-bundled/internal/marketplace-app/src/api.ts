import { getBackendSrv } from '@grafana/runtime';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { Plugin, PluginDetails, Org } from './types';

export default class Api {
  async getRemotePlugins(): Promise<Plugin[]> {
    const res = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins`);
    return res.items;
  }

  async getPlugin(slug: string): Promise<PluginDetails> {
    const res = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins/${slug}`);

    const versions = await this.getPluginVersions(slug);
    const installed = await this.getInstalledPlugins();

    const plugin = installed?.find((_: any) => {
      return _.id === slug;
    });

    return {
      remote: res,
      remoteVersions: versions,
      local: plugin,
    };
  }

  async getPluginVersions(id: string): Promise<any[]> {
    const versions = await getBackendSrv().get(`${GRAFANA_API_ROOT}/plugins/${id}/versions`);
    return versions.items;
  }

  async getInstalledPlugins(): Promise<any> {
    const installed = await getBackendSrv().get('/api/plugins?core=0');
    return installed;
  }

  async getOrg(slug: string): Promise<Org> {
    const org = await getBackendSrv().get(`${GRAFANA_API_ROOT}/orgs/${slug}`);
    return { ...org, avatarUrl: `${GRAFANA_API_ROOT}/orgs/${slug}/avatar` };
  }

  async installPlugin(id: string, version: string) {
    return await getBackendSrv().post(`${API_ROOT}/${id}/install`, {
      version,
    });
  }

  async uninstallPlugin(id: string) {
    return await getBackendSrv().post(`${API_ROOT}/${id}/uninstall`);
  }
}
