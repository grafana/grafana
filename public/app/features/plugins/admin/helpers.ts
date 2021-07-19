import { config } from '@grafana/runtime';
import { CatalogPlugin, LocalPlugin, Plugin } from './types';

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

export function applySearchFilter(searchBy: string | undefined, plugins: CatalogPlugin[]): CatalogPlugin[] {
  if (!searchBy) {
    return plugins;
  }

  return plugins.filter((plugin) => {
    const fields: String[] = [];

    if (plugin.name) {
      fields.push(plugin.name.toLowerCase());
    }

    if (plugin.orgName) {
      fields.push(plugin.orgName.toLowerCase());
    }

    return fields.some((f) => f.includes(searchBy.toLowerCase()));
  });
}
