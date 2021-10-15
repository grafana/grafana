import { config } from '@grafana/runtime';
import { gt } from 'semver';
import { PluginSignatureStatus, dateTimeParse, PluginError } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { Settings } from 'app/core/config';
import { CatalogPlugin, LocalPlugin, RemotePlugin } from './types';

export function isGrafanaAdmin(): boolean {
  return config.bootData.user.isGrafanaAdmin;
}

export function isOrgAdmin() {
  return contextSrv.hasRole('Admin');
}

export function mergeLocalsAndRemotes(
  local: LocalPlugin[] = [],
  remote: RemotePlugin[] = [],
  errors?: PluginError[]
): CatalogPlugin[] {
  const catalogPlugins: CatalogPlugin[] = [];
  const errorByPluginId = groupErrorsByPluginId(errors);

  // add locals
  local.forEach((l) => {
    const remotePlugin = remote.find((r) => r.slug === l.id);
    const error = errorByPluginId[l.id];

    if (!remotePlugin) {
      catalogPlugins.push(mergeLocalAndRemote(l, undefined, error));
    }
  });

  // add remote
  remote.forEach((r) => {
    const localPlugin = local.find((l) => l.id === r.slug);
    const error = errorByPluginId[r.slug];

    catalogPlugins.push(mergeLocalAndRemote(localPlugin, r, error));
  });

  return catalogPlugins;
}

export function mergeLocalAndRemote(local?: LocalPlugin, remote?: RemotePlugin, error?: PluginError): CatalogPlugin {
  if (!local && remote) {
    return mapRemoteToCatalog(remote, error);
  }

  if (local && !remote) {
    return mapLocalToCatalog(local, error);
  }

  return mapToCatalogPlugin(local, remote, error);
}

export function mapRemoteToCatalog(plugin: RemotePlugin, error?: PluginError): CatalogPlugin {
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
  const isDisabled = !!error;
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
    isInstalled: isDisabled,
    isDisabled: isDisabled,
    isCore: plugin.internal,
    isDev: false,
    isEnterprise: status === 'enterprise',
    type: typeCode,
    error: error?.errorCode,
  };
  return catalogPlugin;
}

export function mapLocalToCatalog(plugin: LocalPlugin, error?: PluginError): CatalogPlugin {
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
    isDisabled: !!error,
    isCore: signature === 'internal',
    isDev: Boolean(dev),
    isEnterprise: false,
    type,
    error: error?.errorCode,
  };
}

export function mapToCatalogPlugin(local?: LocalPlugin, remote?: RemotePlugin, error?: PluginError): CatalogPlugin {
  const version = remote?.version || local?.info.version || '';
  const hasUpdate =
    local?.hasUpdate || Boolean(remote?.version && local?.info.version && gt(remote?.version, local?.info.version));
  const id = remote?.slug || local?.id || '';
  const hasRemoteSignature = remote?.signatureType || remote?.versionSignatureType;
  const isDisabled = !!error;

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
    isInstalled: Boolean(local) || isDisabled,
    isDisabled: isDisabled,
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
    error: error?.errorCode,
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

function groupErrorsByPluginId(errors: PluginError[] = []): Record<string, PluginError | undefined> {
  return errors.reduce((byId, error) => {
    byId[error.pluginId] = error;
    return byId;
  }, {} as Record<string, PluginError | undefined>);
}

// Updates the core Grafana config to have the correct list available panels
export const updatePanels = () =>
  getBackendSrv()
    .get('/api/frontend/settings')
    .then((settings: Settings) => {
      config.panels = settings.panels;
    });
