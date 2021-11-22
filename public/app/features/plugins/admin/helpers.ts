import { config } from '@grafana/runtime';
import { PluginSignatureStatus, dateTimeParse, PluginError, PluginErrorCode } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { Settings } from 'app/core/config';
import { CatalogPlugin, LocalPlugin, RemotePlugin, Version } from './types';

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
  } = plugin;

  const isDisabled = !!error;
  return {
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
    signature: getPluginSignatureStatus({ remote: plugin, error }),
    updatedAt,
    hasUpdate: false,
    isPublished: true,
    isInstalled: isDisabled,
    isDisabled: isDisabled,
    isCore: plugin.internal,
    isDev: false,
    isEnterprise: status === 'enterprise',
    type: typeCode,
    error: error?.errorCode,
  };
}

export function mapLocalToCatalog(plugin: LocalPlugin, error?: PluginError): CatalogPlugin {
  const {
    name,
    json: {
      info: { description, version, logos, updated, author },
    },
    id,
    dev,
    type,
    signature,
    hasUpdate,
    dependencies,
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
    signature: getPluginSignatureStatus({ local: plugin, error }),
    signatureOrg: signature.org,
    signatureType: signature.type,
    updatedAt: updated,
    installedVersion: version,
    hasUpdate,
    isInstalled: true,
    isDisabled: !!error,
    isCore: signature.status === 'internal',
    isPublished: false,
    isDev: Boolean(dev),
    isEnterprise: false,
    type,
    error: error?.errorCode,
    dependencies,
  };
}

// TODO: change the signature by removing the optionals for local and remote.
export function mapToCatalogPlugin(local?: LocalPlugin, remote?: RemotePlugin, error?: PluginError): CatalogPlugin {
  const installedVersion = local?.json.info.version;
  const id = remote?.slug || local?.id || '';
  const type = local?.type || remote?.typeCode;
  const isDisabled = !!error;

  let logos = {
    small: `/public/img/icn-${type}.svg`,
    large: `/public/img/icn-${type}.svg`,
  };

  if (remote) {
    logos = {
      small: `https://grafana.com/api/plugins/${id}/versions/${remote.version}/logos/small`,
      large: `https://grafana.com/api/plugins/${id}/versions/${remote.version}/logos/large`,
    };
  } else if (local && local.json.info.logos) {
    logos = local.json.info.logos;
  }

  return {
    description: local?.json.info.description || remote?.description || '',
    downloads: remote?.downloads || 0,
    hasUpdate: local?.hasUpdate || false,
    id,
    info: {
      logos,
    },
    isCore: Boolean(remote?.internal || local?.signature.status === PluginSignatureStatus.internal),
    isDev: Boolean(local?.dev),
    isEnterprise: remote?.status === 'enterprise',
    isInstalled: Boolean(local) || isDisabled,
    isDisabled: isDisabled,
    isPublished: true,
    // TODO<check if we would like to keep preferring the remote version>
    name: remote?.name || local?.name || '',
    // TODO<check if we would like to keep preferring the remote version>
    orgName: remote?.orgName || local?.json.info.author.name || '',
    popularity: remote?.popularity || 0,
    publishedAt: remote?.createdAt || '',
    type,
    signature: getPluginSignatureStatus({ local, remote, error }),
    signatureOrg: local?.signature.org || remote?.versionSignedByOrgName,
    signatureType: local?.signature.type || remote?.versionSignatureType || remote?.signatureType || undefined,
    // TODO<check if we would like to keep preferring the remote version>
    updatedAt: remote?.updatedAt || local?.json.info.updated || '',
    installedVersion,
    error: error?.errorCode,
    dependencies: local?.dependencies,
  };
}

export const getExternalManageLink = (pluginId: string) => `${config.pluginCatalogURL}${pluginId}`;

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

function getPluginSignatureStatus(options: {
  local?: LocalPlugin;
  remote?: RemotePlugin;
  error?: PluginError;
}): PluginSignatureStatus {
  const { error, local, remote } = options;

  if (error) {
    switch (error.errorCode) {
      case PluginErrorCode.invalidSignature:
        return PluginSignatureStatus.invalid;
      case PluginErrorCode.missingSignature:
        return PluginSignatureStatus.missing;
      case PluginErrorCode.modifiedSignature:
        return PluginSignatureStatus.modified;
    }
  }

  if (local?.signature) {
    return local.signature.status;
  }

  if (remote?.signatureType || remote?.versionSignatureType) {
    return PluginSignatureStatus.valid;
  }

  return PluginSignatureStatus.missing;
}

// Updates the core Grafana config to have the correct list available panels
export const updatePanels = () =>
  getBackendSrv()
    .get('/api/frontend/settings')
    .then((settings: Settings) => {
      config.panels = settings.panels;
    });

export function getLatestCompatibleVersion(versions: Version[] | undefined): Version | undefined {
  if (!versions) {
    return;
  }
  const [latest] = versions.filter((v) => Boolean(v.isCompatible));

  return latest;
}

export const isInstallControlsEnabled = () => config.pluginAdminEnabled;

export const isLocalPluginVisible = (p: LocalPlugin) => isPluginVisible(p.id);

export const isRemotePluginVisible = (p: RemotePlugin) => isPluginVisible(p.slug);

function isPluginVisible(id: string) {
  const { pluginCatalogHiddenPlugins }: { pluginCatalogHiddenPlugins: string[] } = config;

  return !pluginCatalogHiddenPlugins.includes(id);
}

export function isLocalCorePlugin(local?: LocalPlugin): boolean {
  return Boolean(local?.signature?.status === 'internal');
}
