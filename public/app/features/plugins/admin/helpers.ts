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

import { CatalogPlugin, LocalPlugin, RemotePlugin, Version } from './types';

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

export function mapRemoteToCatalog(plugin: RemotePlugin, error?: PluginError): CatalogPlugin {
  return {
    id: plugin.slug,
    name: plugin.name,
    orgName: plugin.orgName,
    // category
    description: plugin.description,
    // grafanaDependency
    // pluginDependencies
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

    catalogInfo: {
      downloads: plugin.downloads,
      hasUpdate: false, // We are settings this to `false` by default, as we need to hit a different endpoint to get this info
      isCore: plugin.internal,
      isDev: false,
      isEnterprise: plugin.status === 'enterprise',
      isPublished: true, // If it is found on the remote it means that it is publised
      popularity: plugin.popularity,
      publishedAt: plugin.createdAt,
      signature: getPluginSignature({ remote: plugin, error }),
      signatureOrg: plugin.versionSignedByOrg,
      signatureType: plugin.versionSignatureType as PluginSignatureType,
      updatedAt: plugin.updatedAt,
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
    grafanaDependency: plugin.dependencies.grafanaDependency,
    pluginDependencies: plugin.dependencies.plugins,
    // includes
    // readme
    state: plugin.state as PluginState,
    type: plugin.type,
    author: plugin.info.author,
    links: plugin.info.links,
    logos: plugin.info.logos || defaultLogos,

    settings: {
      defaultNavUrl: plugin.defaultNavUrl,
      enabled: plugin.enabled,
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
      dateTimeParse(b.catalogInfo?.updatedAt || '').valueOf() - dateTimeParse(a.catalogInfo?.updatedAt || '').valueOf(),
    published: (a: CatalogPlugin, b: CatalogPlugin) =>
      dateTimeParse(b.catalogInfo?.publishedAt || '').valueOf() -
      dateTimeParse(a.catalogInfo?.publishedAt || '').valueOf(),
    downloads: (a: CatalogPlugin, b: CatalogPlugin) => b.catalogInfo?.downloads - a.catalogInfo?.downloads,
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
