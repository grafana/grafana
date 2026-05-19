import uFuzzy from '@leeoniya/ufuzzy';
import { Range } from 'semver';

import { PluginSignatureStatus, dateTimeParse, type PluginError, PluginType, PluginErrorCode } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  type CatalogPlugin,
  type InstancePlugin,
  type LocalPlugin,
  PluginUpdateStrategy,
  type ProvisionedPlugin,
  type RemotePlugin,
  RemotePluginStatus,
  type Version,
} from './types';

export function mergeLocalsAndRemotes({
  local = [],
  remote = [],
  instance = [],
  provisioned = [],
  pluginErrors: errors,
}: {
  local: LocalPlugin[];
  remote?: RemotePlugin[];
  instance?: InstancePlugin[];
  provisioned?: ProvisionedPlugin[];
  pluginErrors?: PluginError[];
}): CatalogPlugin[] {
  const catalogPlugins: CatalogPlugin[] = [];
  const errorByPluginId = groupErrorsByPluginId(errors);

  const remoteSet = new Set<string>(remote?.map((plugin) => plugin.slug));
  const localMap = new Map<string, LocalPlugin>(local.map((plugin) => [plugin.id, plugin]));
  const instancesMap = new Map<string, InstancePlugin>(instance?.map((plugin) => [plugin.pluginSlug, plugin]));
  const provisionedSet = new Set<string>(provisioned?.map((plugin) => plugin.slug));

  // add locals
  local.forEach((localPlugin) => {
    const error = errorByPluginId[localPlugin.id];

    if (!remoteSet.has(localPlugin.id)) {
      let catalogPlugin = mergeLocalAndRemote(localPlugin, undefined, error);
      if (config.pluginAdminExternalManageEnabled) {
        catalogPlugin = mergeCloudState(
          catalogPlugin,
          instancesMap,
          provisionedSet.has(localPlugin.id),
          localMap.has(localPlugin.id)
        );
      }
      catalogPlugins.push(catalogPlugin);
    }
  });

  // add remote
  remote.forEach((remotePlugin) => {
    const localCounterpart = localMap.get(remotePlugin.slug);
    const error = errorByPluginId[remotePlugin.slug];
    const shouldSkip = remotePlugin.status === RemotePluginStatus.Deprecated && !localCounterpart; // We are only listing deprecated plugins in case they are installed.

    if (!shouldSkip) {
      let catalogPlugin = mergeLocalAndRemote(localCounterpart, remotePlugin, error);
      if (config.pluginAdminExternalManageEnabled) {
        catalogPlugin = mergeCloudState(
          catalogPlugin,
          instancesMap,
          provisionedSet.has(remotePlugin.slug),
          localMap.has(remotePlugin.slug)
        );
      }
      catalogPlugins.push(catalogPlugin);
    }
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
    angularDetected,
    keywords,
    signatureType,
    versionSignatureType,
    versionSignedByOrgName,
    url,
    category,
  } = plugin;

  const isDisabled = !!error;
  const managedPluginsV2Enabled = getFeatureFlagClient().getBooleanValue(FlagKeys.ManagedPluginsV2, false);

  return {
    description,
    downloads,
    id,
    info: {
      logos: {
        small: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${version}/logos/small`,
        large: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${version}/logos/large`,
      },
      keywords,
    },
    name,
    orgName,
    popularity,
    publishedAt,
    signature: getPluginSignature({ remote: plugin, error }),
    signatureType: signatureType || versionSignatureType || undefined,
    signatureOrg: versionSignedByOrgName,
    updatedAt,
    hasUpdate: false,
    isPublished: true,
    isInstalled: isDisabled,
    isDisabled: isDisabled,
    isPreinstalled: isPreinstalledPlugin(id),
    isDeprecated: status === RemotePluginStatus.Deprecated,
    isCore: plugin.internal,
    isDev: false,
    isEnterprise: status === RemotePluginStatus.Enterprise,
    type: typeCode,
    error: error?.errorCode,
    angularDetected,
    isFullyInstalled: isDisabled,
    latestVersion: plugin.version,
    url,
    managed: {
      enabled: managedPluginsV2Enabled ? Boolean(plugin.managed?.enabled) : isManagedPlugin(id),
      strategy: managedPluginsV2Enabled
        ? plugin.managed?.strategy
        : isManagedPlugin(id)
          ? PluginUpdateStrategy.Assigned
          : undefined,
    },
    category,
    distributionType: plugin.versionDistributionType,
  };
}

export function mapLocalToCatalog(plugin: LocalPlugin, error?: PluginError): CatalogPlugin {
  const {
    name,
    info: { description, version, logos, updated, author, keywords },
    id,
    dev,
    type,
    signature,
    signatureOrg,
    signatureType,
    hasUpdate,
    accessControl,
    angularDetected,
    category,
  } = plugin;

  const isDisabled = !!error;
  const managedPluginsV2Enabled = getFeatureFlagClient().getBooleanValue(FlagKeys.ManagedPluginsV2, false);
  const isV1Managed = !managedPluginsV2Enabled && isManagedPlugin(id);

  return {
    description,
    downloads: 0,
    id,
    info: { logos, keywords },
    name,
    orgName: author.name,
    popularity: 0,
    publishedAt: '',
    signature: getPluginSignature({ local: plugin, error }),
    signatureOrg,
    signatureType,
    updatedAt: updated,
    installedVersion: version,
    hasUpdate,
    isInstalled: true,
    isDisabled: isDisabled,
    isCore: signature === 'internal',
    isPublished: false,
    isDeprecated: false,
    isDev: Boolean(dev),
    isEnterprise: false,
    isPreinstalled: isPreinstalledPlugin(id),
    type,
    error: error?.errorCode,
    accessControl: accessControl,
    angularDetected,
    isFullyInstalled: true,
    iam: plugin.iam,
    latestVersion: plugin.latestVersion,
    managed: {
      enabled: isV1Managed,
      strategy: isV1Managed ? PluginUpdateStrategy.Assigned : undefined,
    },
    category,
  };
}

// TODO: change the signature by removing the optionals for local and remote.
export function mapToCatalogPlugin(local?: LocalPlugin, remote?: RemotePlugin, error?: PluginError): CatalogPlugin {
  const installedVersion = local?.info.version;
  const id = remote?.slug || local?.id || '';
  const type = local?.type || remote?.typeCode;
  const isDisabled = !!error;
  const keywords = remote?.keywords || local?.info.keywords || [];

  let logos = {
    small: `/public/build/img/icn-${type}.svg`,
    large: `/public/build/img/icn-${type}.svg`,
  };

  if (remote) {
    logos = {
      small: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${remote.version}/logos/small`,
      large: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${remote.version}/logos/large`,
    };
  } else if (local && local.info.logos) {
    logos = local.info.logos;
  }

  const managedPluginsV2Enabled = getFeatureFlagClient().getBooleanValue(FlagKeys.ManagedPluginsV2, false);

  return {
    description: local?.info.description || remote?.description || '',
    downloads: remote?.downloads || 0,
    hasUpdate: local?.hasUpdate || false,
    id,
    info: {
      logos,
      keywords,
    },
    isCore: Boolean(remote?.internal || local?.signature === PluginSignatureStatus.internal),
    isDev: Boolean(local?.dev),
    isEnterprise: remote?.status === RemotePluginStatus.Enterprise,
    isInstalled: Boolean(local) || isDisabled,
    isDisabled: isDisabled,
    isDeprecated: remote?.status === RemotePluginStatus.Deprecated,
    isPublished: true,
    isPreinstalled: isPreinstalledPlugin(id),
    // TODO<check if we would like to keep preferring the remote version>
    name: remote?.name || local?.name || '',
    // TODO<check if we would like to keep preferring the remote version>
    orgName: remote?.orgName || local?.info.author.name || '',
    popularity: remote?.popularity || 0,
    publishedAt: remote?.createdAt || '',
    type,
    signature: getPluginSignature({ local, remote, error }),
    signatureOrg: local?.signatureOrg || remote?.versionSignedByOrgName,
    signatureType: local?.signatureType || remote?.versionSignatureType || remote?.signatureType || undefined,
    // TODO<check if we would like to keep preferring the remote version>
    updatedAt: remote?.updatedAt || local?.info.updated || '',
    installedVersion,
    error: error?.errorCode,
    // Only local plugins have access control metadata
    accessControl: local?.accessControl,
    angularDetected: local?.angularDetected ?? remote?.angularDetected,
    isFullyInstalled: Boolean(local) || isDisabled,
    iam: local?.iam,
    latestVersion: local?.latestVersion || remote?.version || '',
    url: remote?.url || '',
    managed: {
      enabled: managedPluginsV2Enabled ? Boolean(remote?.managed?.enabled) : isManagedPlugin(id),
      strategy: managedPluginsV2Enabled
        ? remote?.managed?.strategy
        : isManagedPlugin(id)
          ? PluginUpdateStrategy.Assigned
          : undefined,
    },
    category: remote?.category || local?.category || '',
    distributionType: remote?.versionDistributionType,
  };
}

export const getExternalManageLink = (pluginId: string) => `${config.pluginCatalogURL}${pluginId}`;

export function isMarketplacePlugin(plugin: CatalogPlugin): boolean {
  return plugin.distributionType === 'marketplace';
}

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
  return errors.reduce<Record<string, PluginError | undefined>>((byId, error) => {
    byId[error.pluginId] = error;
    return byId;
  }, {});
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

  if (remote?.signatureType && remote?.versionSignatureType) {
    return PluginSignatureStatus.valid;
  }

  return PluginSignatureStatus.missing;
}

export function getLatestCompatibleVersion(versions: Version[] | undefined): Version | undefined {
  if (!versions) {
    return;
  }
  const [latest] = versions.filter((v) => Boolean(v.isCompatible));

  return latest;
}

export const isInstallControlsEnabled = () => config.pluginAdminEnabled;

export const hasInstallControlWarning = (
  plugin: CatalogPlugin,
  isRemotePluginsAvailable: boolean,
  latestCompatibleVersion?: Version
) => {
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
  const isCompatible = Boolean(latestCompatibleVersion);
  return (
    plugin.type === PluginType.renderer ||
    (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) ||
    plugin.isDev ||
    (!hasPermission && !isExternallyManaged) ||
    !plugin.isPublished ||
    !isCompatible ||
    !isRemotePluginsAvailable
  );
};

export const isLocalPluginVisibleByConfig = (p: LocalPlugin) => isNotHiddenByConfig(p.id);

export const isRemotePluginVisibleByConfig = (p: RemotePlugin) => isNotHiddenByConfig(p.slug);

function isNotHiddenByConfig(id: string) {
  const { pluginCatalogHiddenPlugins }: { pluginCatalogHiddenPlugins: string[] } = config;

  return !pluginCatalogHiddenPlugins.includes(id);
}

/**
 * isManagedPlugin checks if the plugin is managed according to the instances config
 * this will be removed when managed plugins v2 is fully enabled
 * @param id - The plugin ID
 * @returns True if the plugin is managed
 */
export function isManagedPlugin(id: string) {
  const { pluginCatalogManagedPlugins }: { pluginCatalogManagedPlugins: string[] } = config;

  return pluginCatalogManagedPlugins?.includes(id);
}

export function isPreinstalledPlugin(id: string): { found: boolean; withVersion: boolean } {
  const { pluginCatalogPreinstalledPlugins } = config;

  const plugin = pluginCatalogPreinstalledPlugins?.find((p) => p.id === id);
  return { found: !!plugin?.id, withVersion: !!plugin?.version };
}

export function isLocalCorePlugin(local?: LocalPlugin): boolean {
  return Boolean(local?.signature === 'internal');
}

function getId(inputString: string): string {
  const parts = inputString.split(' - ');
  return parts[0];
}

function getPluginDetailsForFuzzySearch(plugins: CatalogPlugin[]): string[] {
  return plugins.reduce((result: string[], { id, name, type, orgName, info }: CatalogPlugin) => {
    const keywordsForSearch = info.keywords?.join(' ').toLowerCase();
    const pluginString = `${id} - ${name} - ${type} - ${orgName} - ${keywordsForSearch}`;
    result.push(pluginString);
    return result;
  }, []);
}
export function filterByKeyword(plugins: CatalogPlugin[], query: string) {
  const dataArray = getPluginDetailsForFuzzySearch(plugins);
  let uf = new uFuzzy({ intraMode: 1, intraSub: 0 });
  let idxs = uf.filter(dataArray, query);
  if (idxs === null) {
    return null;
  }
  return idxs.map((id) => getId(dataArray[id]));
}

function isPluginModifiable(plugin: CatalogPlugin) {
  if (
    plugin.isProvisioned || //provisioned plugins cannot be modified
    plugin.isCore || //core plugins cannot be modified
    plugin.type === PluginType.renderer || // currently renderer plugins are not supported by the catalog due to complications related to installation / update / uninstall
    plugin.isPreinstalled.withVersion // Preinstalled plugins (with specified version) cannot be modified
  ) {
    return false;
  }

  // Managed plugins with 'assigned' strategy cannot be modified
  if (plugin.managed.enabled && plugin.managed.strategy === PluginUpdateStrategy.Assigned) {
    return false;
  }

  return true;
}

export function isPluginUpdatable(plugin: CatalogPlugin) {
  if (!isPluginModifiable(plugin)) {
    return false;
  }

  // If there is no update available, the plugin cannot be updated
  if (!plugin.hasUpdate) {
    return false;
  }

  // If the plugin is currently being updated, it should not be updated
  if (plugin.isUpdatingFromInstance) {
    return false;
  }

  return true;
}

export function shouldDisablePluginInstall(plugin: CatalogPlugin) {
  if (
    !isPluginModifiable(plugin) ||
    (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) ||
    !plugin.isPublished ||
    plugin.isDisabled ||
    !isInstallControlsEnabled()
  ) {
    return true;
  }

  return false;
}

export function isNonAngularVersion(version?: Version) {
  if (!version) {
    return false;
  }

  return version.angularDetected === false;
}

export function isDisabledAngularPlugin(plugin: CatalogPlugin) {
  return plugin.isDisabled && plugin.error === PluginErrorCode.angular;
}

/**
 * Formats a semver range string (e.g. ">= 8.5.20 < 9 || >= 9.1.0")
 * into a human-readable string (e.g. "8.5.20 – 9.0.0, 9.1.0 or later").
 */
export function formatGrafanaDependency(dependency: string | null): string {
  if (!dependency) {
    return 'N/A';
  }

  try {
    const range = new Range(dependency);
    const parts: string[] = [];

    for (const comparators of range.set) {
      const lowerBound = comparators.find((c) => c.operator === '>=');
      const upperBound = comparators.find((c) => c.operator === '<');

      if (lowerBound && upperBound) {
        const from = formatVersion(lowerBound.semver.major, lowerBound.semver.minor, lowerBound.semver.patch);
        const to = formatVersion(upperBound.semver.major, upperBound.semver.minor, upperBound.semver.patch);
        parts.push(`${from} – ${to}`);
      } else if (lowerBound) {
        const from = formatVersion(lowerBound.semver.major, lowerBound.semver.minor, lowerBound.semver.patch);
        parts.push(`${from} or later`);
      } else if (upperBound) {
        const to = formatVersion(upperBound.semver.major, upperBound.semver.minor, upperBound.semver.patch);
        parts.push(`before ${to}`);
      } else {
        return dependency;
      }
    }

    return parts.join(', ');
  } catch {
    return dependency;
  }
}

function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

export function mergeCloudState(
  catalogPlugin: CatalogPlugin,
  instanceMap: Map<string, InstancePlugin>,
  isProvisioned: boolean,
  hasLocal: boolean
) {
  const instancePlugin = instanceMap.get(catalogPlugin.id);

  return {
    ...catalogPlugin,
    isFullyInstalled: catalogPlugin.isCore
      ? true
      : (instanceMap.has(catalogPlugin.id) || isProvisioned) && catalogPlugin.isInstalled,
    isInstalled: instanceMap.has(catalogPlugin.id) || catalogPlugin.isInstalled,
    isUpdatingFromInstance:
      instanceMap.has(catalogPlugin.id) &&
      catalogPlugin.hasUpdate &&
      catalogPlugin.installedVersion !== instancePlugin?.version,
    hasUpdate: Boolean(instancePlugin?.version && instancePlugin?.version !== catalogPlugin.latestVersion),
    isUninstallingFromInstance: hasLocal && !instanceMap.has(catalogPlugin.id),
    isProvisioned: isProvisioned,
  };
}
