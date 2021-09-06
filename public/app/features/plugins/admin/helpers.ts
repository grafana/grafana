import { config } from '@grafana/runtime';
import { gt } from 'semver';
import { PluginSignatureStatus, PluginSignatureType } from '@grafana/data';
import { CatalogPlugin, CatalogPluginDetails, LocalPlugin, RemotePlugin, Version, PluginFilter } from './types';
import { contextSrv } from 'app/core/services/context_srv';

export function isGrafanaAdmin(): boolean {
  return config.bootData.user.isGrafanaAdmin;
}

export function isOrgAdmin() {
  return contextSrv.hasRole('Admin');
}

export function mergeLocalsAndRemotes(local: LocalPlugin[] = [], remote: RemotePlugin[] = []): CatalogPlugin[] {
  // TODO<use a Set() here instead of Array.prototype.find()>
  const catalogPlugins: CatalogPlugin[] = [];

  // add remote
  remote.forEach((r) => {
    const localPlugin = local.find((l) => l.id === r.slug);

    catalogPlugins.push(mergeLocalAndRemote(localPlugin, r));
  });

  // add locals
  local.forEach((l) => {
    const catalogPlugin = catalogPlugins.find((p) => p.id === l.id);

    if (!catalogPlugin) {
      catalogPlugins.push(mergeLocalAndRemote(l));
    }
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

export function getCatalogPluginDetails(
  local: LocalPlugin | undefined,
  remote: RemotePlugin | undefined,
  pluginVersions: Version[] = []
): CatalogPluginDetails {
  const plugin = mapToCatalogPlugin(local, remote);

  return {
    ...plugin,
    grafanaDependency: remote?.json?.dependencies?.grafanaDependency || '',
    links: remote?.json?.info.links || local?.info.links || [],
    readme: remote?.readme || 'No plugin help or readme markdown file was found',
    versions: pluginVersions,
  };
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

export const getExternalManageLink = (pluginId: string) => `https://grafana.com/grafana/plugins/${pluginId}`;
