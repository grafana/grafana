import { config } from '@grafana/runtime';
import { gt } from 'semver';
import { PluginSignatureStatus, dateTimeParse } from '@grafana/data';
import { CatalogPlugin, LocalPlugin, RemotePlugin } from './types';
import { contextSrv } from 'app/core/services/context_srv';

export function isGrafanaAdmin(): boolean {
  return config.bootData.user.isGrafanaAdmin;
}

export function isOrgAdmin() {
  return contextSrv.hasRole('Admin');
}

export function mergeLocalsAndRemotes(local: LocalPlugin[] = [], remote: RemotePlugin[] = []): CatalogPlugin[] {
  const catalogPlugins: CatalogPlugin[] = [];

  // add locals
  local.forEach((l) => {
    const remotePlugin = remote.find((r) => r.slug === l.id);

    if (!remotePlugin) {
      catalogPlugins.push(mergeLocalAndRemote(l));
    }
  });

  // add remote
  remote.forEach((r) => {
    const localPlugin = local.find((l) => l.id === r.slug);

    catalogPlugins.push(mergeLocalAndRemote(localPlugin, r));
  });

  return catalogPlugins;
}

export function mergeLocalAndRemote(local?: LocalPlugin, remote?: RemotePlugin): CatalogPlugin {
  if (!local && remote) {
    return mapRemoteToCatalog(remote);
  }

  if (local && !remote) {
    return mapLocalToCatalog(local);
  }

  return mapToCatalogPlugin(local, remote);
}

export function mapRemoteToCatalog(plugin: RemotePlugin): CatalogPlugin {
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
    versionSignatureType,
    signatureType,
  } = plugin;

  const hasSignature = signatureType !== '' || versionSignatureType !== '';
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
    signature: hasSignature ? PluginSignatureStatus.valid : PluginSignatureStatus.missing,
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
    signatureOrg,
    signatureType,
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
    signature,
    signatureOrg,
    signatureType,
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

export function mapToCatalogPlugin(local?: LocalPlugin, remote?: RemotePlugin): CatalogPlugin {
  const version = remote?.version || local?.info.version || '';
  const hasUpdate =
    local?.hasUpdate || Boolean(remote?.version && local?.info.version && gt(remote?.version, local?.info.version));
  const id = remote?.slug || local?.id || '';
  const hasRemoteSignature = remote?.signatureType !== '' || remote?.versionSignatureType !== '';
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

  return {
    description: remote?.description || local?.info.description || '',
    downloads: remote?.downloads || 0,
    hasUpdate,
    id,
    info: {
      logos,
    },
    isCore: Boolean(remote?.internal || local?.signature === PluginSignatureStatus.internal),
    isDev: Boolean(local?.dev),
    isEnterprise: remote?.status === 'enterprise',
    isInstalled: Boolean(local),
    name: remote?.name || local?.name || '',
    orgName: remote?.orgName || local?.info.author.name || '',
    popularity: remote?.popularity || 0,
    publishedAt: remote?.createdAt || '',
    type: remote?.typeCode || local?.type,
    signature: local?.signature || (hasRemoteSignature ? PluginSignatureStatus.valid : PluginSignatureStatus.missing),
    signatureOrg: local?.signatureOrg || remote?.versionSignedByOrgName,
    signatureType: local?.signatureType || remote?.versionSignatureType || remote?.signatureType || undefined,
    updatedAt: remote?.updatedAt || local?.info.updated || '',
    version,
  };
}

export const getExternalManageLink = (pluginId: string) => `https://grafana.com/grafana/plugins/${pluginId}`;

export enum Sorters {
  nameAsc = 'nameAsc',
  nameDesc = 'nameDesc',
  updated = 'updated',
  published = 'published',
  downloads = 'downloads',
}

export const sortPlugins = (plugins: CatalogPlugin[], sortBy: Sorters) => {
  const sorters: { [name: string]: (a: CatalogPlugin, b: CatalogPlugin) => number } = {
    nameAsc: (a: CatalogPlugin, b: CatalogPlugin) => a.name.localeCompare(b.name),
    nameDesc: (a: CatalogPlugin, b: CatalogPlugin) => b.name.localeCompare(a.name),
    updated: (a: CatalogPlugin, b: CatalogPlugin) =>
      dateTimeParse(b.updatedAt).valueOf() - dateTimeParse(a.updatedAt).valueOf(),
    published: (a: CatalogPlugin, b: CatalogPlugin) =>
      dateTimeParse(b.publishedAt).valueOf() - dateTimeParse(a.publishedAt).valueOf(),
    downloads: (a: CatalogPlugin, b: CatalogPlugin) => b.downloads - a.downloads,
  };

  if (sorters[sortBy]) {
    return plugins.sort(sorters[sortBy]);
  }

  return plugins;
};
