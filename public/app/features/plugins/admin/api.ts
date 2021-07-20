import { getBackendSrv } from '@grafana/runtime';
import { gt } from 'semver';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { Plugin, PluginDetails, CatalogPluginDetails, Org, LocalPlugin } from './types';

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

async function getCatalogPlugin(slug: string): Promise<CatalogPluginDetails> {
  const installed = await getInstalledPlugins();
  const local = installed?.find((plugin: LocalPlugin) => plugin.id === slug);
  const [remote, versions] = await Promise.all([getRemotePlugin(slug, local), getPluginVersions(slug)]);

  // TODO: none of the following should live in the api layer. Move to a helper.
  const version = remote?.version || local?.info.version || '';
  const hasUpdate = Boolean(remote?.version && local?.info.version && gt(remote?.version, local?.info.version));

  let logos = {
    small: 'https://grafana.com/api/plugins/404notfound/versions/none/logos/small',
    large: 'https://grafana.com/api/plugins/404notfound/versions/none/logos/large',
  };

  if (remote) {
    logos = {
      small: `https://grafana.com/api/plugins/${slug}/versions/${version}/logos/small`,
      large: `https://grafana.com/api/plugins/${slug}/versions/${version}/logos/large`,
    };
  } else if (local && local.info.logos) {
    logos = local.info.logos;
  }

  const plugin = {
    description: remote?.description || local?.info.description || '',
    downloads: remote?.downloads || 0,
    grafanaDependency: remote?.json?.dependencies?.grafanaDependency || '',
    hasUpdate,
    id: remote?.slug || local?.id || '',
    info: {
      logos,
    },
    isCore: Boolean(remote?.internal || local?.signature === 'internal'),
    isDev: Boolean(local?.dev),
    isEnterprise: remote?.status === 'enterprise' || false,
    isInstalled: Boolean(local),
    links: remote?.json?.info.links || local?.info.links || [],
    name: remote?.name || local?.name || '',
    orgName: remote?.orgName || local?.info.author.name || '',
    popularity: remote?.popularity || 0,
    publishedAt: remote?.createdAt || '',
    readme: remote?.readme || 'No plugin help or readme markdown file was found',
    type: remote?.typeCode || local?.type || '',
    updatedAt: remote?.updatedAt || local?.info.updated || '',
    version,
    versions,
  };

  return plugin;
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

async function getInstalledPlugins(): Promise<LocalPlugin[]> {
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
  getCatalogPlugin,
  getInstalledPlugins,
  getOrg,
  installPlugin,
  uninstallPlugin,
};
