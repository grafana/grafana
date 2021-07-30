import { config } from '@grafana/runtime';
import { gt } from 'semver';
import { CatalogPlugin, CatalogPluginDetails, LocalPlugin, Plugin, Version, PluginFilter } from './types';

export function isGrafanaAdmin(): boolean {
  return config.bootData.user.isGrafanaAdmin;
}

export function mapRemoteToCatalog(plugin: Plugin): CatalogPlugin {
  const {
    name,
    slug: id,
    description,
    version,
    orgName,
    popularity,
    downloads,
    typeCode,
    updatedAt,
    createdAt: publishedAt,
    status,
  } = plugin;
  const catalogPlugin = {
    description,
    downloads,
    id,
    info: {
      logos: {
        small: `https://grafana.com/api/plugins/${id}/versions/${version}/logos/small`,
        large: `https://grafana.com/api/plugins/${id}/versions/${version}/logos/large`,
      },
    },
    name,
    orgName,
    popularity,
    publishedAt,
    updatedAt,
    version,
    hasUpdate: false,
    isInstalled: false,
    isCore: plugin.internal,
    isDev: false,
    isEnterprise: status === 'enterprise',
    type: typeCode,
  };
  return catalogPlugin;
}

export function mapLocalToCatalog(plugin: LocalPlugin): CatalogPlugin {
  const {
    name,
    info: { description, version, logos, updated, author },
    id,
    signature,
    dev,
    type,
  } = plugin;
  return {
    description,
    downloads: 0,
    id,
    info: { logos },
    name,
    orgName: author.name,
    popularity: 0,
    publishedAt: '',
    updatedAt: updated,
    version,
    hasUpdate: false,
    isInstalled: true,
    isCore: signature === 'internal',
    isDev: Boolean(dev),
    isEnterprise: false,
    type,
  };
}

export function getCatalogPluginDetails(
  local: LocalPlugin | undefined,
  remote: Plugin | undefined,
  pluginVersions: Version[] | undefined
): CatalogPluginDetails {
  const version = remote?.version || local?.info.version || '';
  const hasUpdate = Boolean(remote?.version && local?.info.version && gt(remote?.version, local?.info.version));
  const id = remote?.slug || local?.id || '';

  let logos = {
    small: 'https://grafana.com/api/plugins/404notfound/versions/none/logos/small',
    large: 'https://grafana.com/api/plugins/404notfound/versions/none/logos/large',
  };

  if (remote) {
    logos = {
      small: `https://grafana.com/api/plugins/${id}/versions/${version}/logos/small`,
      large: `https://grafana.com/api/plugins/${id}/versions/${version}/logos/large`,
    };
  } else if (local && local.info.logos) {
    logos = local.info.logos;
  }

  const plugin = {
    description: remote?.description || local?.info.description || '',
    downloads: remote?.downloads || 0,
    grafanaDependency: remote?.json?.dependencies?.grafanaDependency || '',
    hasUpdate,
    id,
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
    versions: pluginVersions || [],
  };

  return plugin;
}

export const isInstalled: PluginFilter = (plugin, query) =>
  query === 'installed' ? plugin.isInstalled : !plugin.isCore;

export const isType: PluginFilter = (plugin, query) => query === 'all' || plugin.type === query;

export const matchesKeyword: PluginFilter = (plugin, query) => {
  if (!query) {
    return true;
  }
  const fields: String[] = [];
  if (plugin.name) {
    fields.push(plugin.name.toLowerCase());
  }

  if (plugin.orgName) {
    fields.push(plugin.orgName.toLowerCase());
  }

  return fields.some((f) => f.includes(query.toLowerCase()));
};
