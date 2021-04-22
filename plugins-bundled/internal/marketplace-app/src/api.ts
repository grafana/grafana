import { getBackendSrv } from '@grafana/runtime';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { Plugin, PluginDetails, Org } from './types';

export default class Api {
  baseUrl: string;
  pluginDir?: string;

  constructor(pluginDir?: string) {
    this.baseUrl = '';
    this.pluginDir = pluginDir;
  }

  async getRemotePlugins(): Promise<Plugin[]> {
    const res = await getBackendSrv().get(`${API_ROOT}/plugins`);
    return res.items;
  }

  async getPlugin(slug: string): Promise<PluginDetails> {
    const res = await getBackendSrv().get(`${API_ROOT}/plugins/${slug}`);

    const versions = await this.getPluginVersions(slug);
    const installed = await this.getInstalledPlugins();

    const plugin = installed?.find((_: any) => _.id === slug);

    return {
      remote: res,
      remoteVersions: versions,
      local: plugin,
    };
  }

  async getPluginVersions(id: string): Promise<any[]> {
    const versions = await getBackendSrv().get(`${API_ROOT}/plugins/${id}/versions`);
    return versions.items;
  }

  async getInstalledPlugins(): Promise<any> {
    const installed = await getBackendSrv().get(`${API_ROOT}/installed?pluginDir=${this.pluginDir}`);
    return installed;
  }

  async getOrg(slug: string): Promise<Org> {
    const org = await getBackendSrv().get(`${API_ROOT}/orgs/${slug}`);
    return { ...org, avatarUrl: `${GRAFANA_API_ROOT}/orgs/${slug}/avatar` };
  }

  async installPlugin(id: string, v: string, pkg?: string) {
    const versions = await this.getPluginVersions(id);

    const version = versions.find((_) => _.version === v);

    if (!version) {
      throw new Error('No such version');
    }

    const selfLink = version.links.find((_: any) => _.rel === 'self');
    if (!selfLink) {
      throw new Error('Missing download information for version');
    }

    let downloadUrl = GRAFANA_API_ROOT + selfLink.href + '/download';

    const pair = pkg?.split('-');
    if (pair?.length === 2) {
      downloadUrl = `${downloadUrl}?os=${pair[0]}&arch=${pair[1]}`;
    }

    await getBackendSrv().post(
      `${API_ROOT}/install`,
      JSON.stringify({
        url: downloadUrl,
        pluginDir: this.pluginDir,
      })
    );
  }

  async uninstallPlugin(id: string) {
    await getBackendSrv().post(`${API_ROOT}/uninstall`, JSON.stringify({ slug: id, pluginDir: this.pluginDir }));
  }
}
