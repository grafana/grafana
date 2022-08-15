import { merge } from 'lodash';

import {
  PluginState,
  PluginSignatureType,
  PluginSignatureStatus,
  dateTimeParse,
  PluginError,
  PluginType,
  PluginErrorCode,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { Settings } from 'app/core/config';
import { getBackendSrv } from 'app/core/services/backend_srv';

import { CatalogPlugin, LocalPlugin, RemotePlugin, Version } from '../types';

export function mergeLocalsAndRemotes(
  local: LocalPlugin[] = [],
  remote: RemotePlugin[] = [],
  errors?: PluginError[]
): CatalogPlugin[] {
  const errorByPluginId = groupErrorsByPluginId(errors);
  const findRemote = ({ id }: LocalPlugin) => remote.find(({ slug }) => slug === id);
  const hasRemote = ({ id }: LocalPlugin) => remote.some(({ slug }) => slug === id);
  const hasNoRemote = (p: LocalPlugin) => !hasRemote(p);
  const hasNoLocal = ({ slug }: RemotePlugin) => !local.some(({ id }) => id === slug);
  const localOnly = local.filter(hasNoRemote).map((p) => mapLocalToCatalog(p, errorByPluginId[p.id]));
  const remoteOnly = remote.filter(hasNoLocal).map((p) => mapRemoteToCatalog(p, errorByPluginId[p.id]));
  const localAndRemote = local
    .filter(hasRemote)
    .map((p) => merge(mapRemoteToCatalog(findRemote(p)!, errorByPluginId[p.id]), mapLocalToCatalog(p)));

  return [...localOnly, ...remoteOnly, ...localAndRemote];
}

export function mergeLocalAndRemote(local: LocalPlugin, remote: RemotePlugin, error?: PluginError) {
  return merge(mapRemoteToCatalog(remote, error), mapLocalToCatalog(local));
}

export function mapRemoteToCatalog(plugin: RemotePlugin, error?: PluginError): CatalogPlugin {
  return {
    id: plugin.slug,
    name: plugin.name,
    orgName: plugin.orgName,
    // category
    description: plugin.description,
    grafanaDependency: plugin.json?.dependencies.grafanaDependency,
    pluginDependencies: plugin.json?.dependencies.plugins,
    // includes
    // readme
    // state
    type: plugin.typeCode,
    // author
    // links
    logos: {
      small: `https://grafana.com/api/plugins/${plugin.id}/versions/${plugin.version}/logos/small`,
      large: `https://grafana.com/api/plugins/${plugin.id}/versions/${plugin.version}/logos/large`,
    },

    // Catalog related
    info: {
      downloads: plugin.downloads,
      isCore: plugin.internal,
      isDev: false,
      isEnterprise: plugin.status === 'enterprise',
      isPublished: true, // If it is found on the remote it means that it is publised
      publishedAt: plugin.createdAt,
      updatedAt: plugin.updatedAt,
      popularity: plugin.popularity,
      signature: getPluginSignature({ remote: plugin, error }),
      signatureOrg: plugin.versionSignedByOrg,
      signatureType: plugin.versionSignatureType as PluginSignatureType,
      versions: [],
    },

    // Install related
    // (setting a default here, as there are plugins which are not installed)
    settings: {
      isDisabled: false,
      isInstalled: false,
      hasUpdate: false,
    },

    error: error?.errorCode,
  };
}

export function mapLocalToCatalog(plugin: LocalPlugin, error?: PluginError): CatalogPlugin {
  const defaultLogos = {
    small: `/public/img/icn-${plugin.type}.svg`,
    large: `/public/img/icn-${plugin.type}.svg`,
  };

  return {
    id: plugin.id,
    name: plugin.name,
    // orgName
    // category
    description: plugin.info.description,
    grafanaDependency: plugin.dependencies.grafanaDependency || '',
    pluginDependencies: plugin.dependencies.plugins,
    // includes
    // readme
    state: plugin.state as PluginState,
    type: plugin.type,
    author: plugin.info.author,
    links: plugin.info.links,
    logos: plugin.info.logos || defaultLogos,

    // Catalog related
    // (setting a default value here, as there are plugins which don't have a remote counterpart)
    info: {
      downloads: 0,
      isCore: plugin.signature === 'internal',
      isDev: Boolean(plugin.dev),
      isEnterprise: false,
      isPublished: false,
      publishedAt: '',
      updatedAt: '',
      popularity: 0,
      signature: getPluginSignature({ local: plugin, error }),
      signatureOrg: plugin.signatureOrg,
      signatureType: plugin.signatureType,
      versions: [],
    },

    // Install related
    settings: {
      defaultNavUrl: plugin.defaultNavUrl,
      enabled: plugin.enabled,
      hasUpdate: plugin.hasUpdate,
      isDisabled: !!error || isDisabledSecretsPlugin(plugin.type),
      isInstalled: true,
      isPinned: plugin.pinned,
      version: plugin.info.version,
    },

    error: error?.errorCode,
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
      dateTimeParse(b.info.updatedAt || '').valueOf() - dateTimeParse(a.info.updatedAt || '').valueOf(),
    published: (a: CatalogPlugin, b: CatalogPlugin) =>
      dateTimeParse(b.info.publishedAt || '').valueOf() - dateTimeParse(a.info.publishedAt || '').valueOf(),
    downloads: (a: CatalogPlugin, b: CatalogPlugin) => b.info.downloads - a.info.downloads,
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

function getPluginSignature(options: {
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
    return local.signature;
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

function isDisabledSecretsPlugin(type?: PluginType): boolean {
  return type === PluginType.secretsmanager && !config.secretsManagerPluginEnabled;
}

export function isLocalCorePlugin(local?: LocalPlugin): boolean {
  return Boolean(local?.signature === 'internal');
}
