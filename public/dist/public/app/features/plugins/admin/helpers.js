import { PluginSignatureStatus, dateTimeParse, PluginType, PluginErrorCode } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { AccessControlAction } from 'app/types';
import { RemotePluginStatus } from './types';
export function mergeLocalsAndRemotes(local = [], remote = [], errors) {
    const catalogPlugins = [];
    const errorByPluginId = groupErrorsByPluginId(errors);
    // add locals
    local.forEach((localPlugin) => {
        const remoteCounterpart = remote.find((r) => r.slug === localPlugin.id);
        const error = errorByPluginId[localPlugin.id];
        if (!remoteCounterpart) {
            catalogPlugins.push(mergeLocalAndRemote(localPlugin, undefined, error));
        }
    });
    // add remote
    remote.forEach((remotePlugin) => {
        const localCounterpart = local.find((l) => l.id === remotePlugin.slug);
        const error = errorByPluginId[remotePlugin.slug];
        const shouldSkip = remotePlugin.status === RemotePluginStatus.Deprecated && !localCounterpart; // We are only listing deprecated plugins in case they are installed.
        if (!shouldSkip) {
            catalogPlugins.push(mergeLocalAndRemote(localCounterpart, remotePlugin, error));
        }
    });
    return catalogPlugins;
}
export function mergeLocalAndRemote(local, remote, error) {
    if (!local && remote) {
        return mapRemoteToCatalog(remote, error);
    }
    if (local && !remote) {
        return mapLocalToCatalog(local, error);
    }
    return mapToCatalogPlugin(local, remote, error);
}
export function mapRemoteToCatalog(plugin, error) {
    const { name, slug: id, description, version, orgName, popularity, downloads, typeCode, updatedAt, createdAt: publishedAt, status, angularDetected, } = plugin;
    const isDisabled = !!error || isDisabledSecretsPlugin(typeCode);
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
        signature: getPluginSignature({ remote: plugin, error }),
        updatedAt,
        hasUpdate: false,
        isPublished: true,
        isInstalled: isDisabled,
        isDisabled: isDisabled,
        isDeprecated: status === RemotePluginStatus.Deprecated,
        isCore: plugin.internal,
        isDev: false,
        isEnterprise: status === RemotePluginStatus.Enterprise,
        type: typeCode,
        error: error === null || error === void 0 ? void 0 : error.errorCode,
        angularDetected,
    };
}
export function mapLocalToCatalog(plugin, error) {
    const { name, info: { description, version, logos, updated, author }, id, dev, type, signature, signatureOrg, signatureType, hasUpdate, accessControl, angularDetected, } = plugin;
    const isDisabled = !!error || isDisabledSecretsPlugin(type);
    return {
        description,
        downloads: 0,
        id,
        info: { logos },
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
        type,
        error: error === null || error === void 0 ? void 0 : error.errorCode,
        accessControl: accessControl,
        angularDetected,
    };
}
// TODO: change the signature by removing the optionals for local and remote.
export function mapToCatalogPlugin(local, remote, error) {
    const installedVersion = local === null || local === void 0 ? void 0 : local.info.version;
    const id = (remote === null || remote === void 0 ? void 0 : remote.slug) || (local === null || local === void 0 ? void 0 : local.id) || '';
    const type = (local === null || local === void 0 ? void 0 : local.type) || (remote === null || remote === void 0 ? void 0 : remote.typeCode);
    const isDisabled = !!error || isDisabledSecretsPlugin(type);
    let logos = {
        small: `/public/img/icn-${type}.svg`,
        large: `/public/img/icn-${type}.svg`,
    };
    if (remote) {
        logos = {
            small: `https://grafana.com/api/plugins/${id}/versions/${remote.version}/logos/small`,
            large: `https://grafana.com/api/plugins/${id}/versions/${remote.version}/logos/large`,
        };
    }
    else if (local && local.info.logos) {
        logos = local.info.logos;
    }
    return {
        description: (local === null || local === void 0 ? void 0 : local.info.description) || (remote === null || remote === void 0 ? void 0 : remote.description) || '',
        downloads: (remote === null || remote === void 0 ? void 0 : remote.downloads) || 0,
        hasUpdate: (local === null || local === void 0 ? void 0 : local.hasUpdate) || false,
        id,
        info: {
            logos,
        },
        isCore: Boolean((remote === null || remote === void 0 ? void 0 : remote.internal) || (local === null || local === void 0 ? void 0 : local.signature) === PluginSignatureStatus.internal),
        isDev: Boolean(local === null || local === void 0 ? void 0 : local.dev),
        isEnterprise: (remote === null || remote === void 0 ? void 0 : remote.status) === RemotePluginStatus.Enterprise,
        isInstalled: Boolean(local) || isDisabled,
        isDisabled: isDisabled,
        isDeprecated: (remote === null || remote === void 0 ? void 0 : remote.status) === RemotePluginStatus.Deprecated,
        isPublished: true,
        // TODO<check if we would like to keep preferring the remote version>
        name: (remote === null || remote === void 0 ? void 0 : remote.name) || (local === null || local === void 0 ? void 0 : local.name) || '',
        // TODO<check if we would like to keep preferring the remote version>
        orgName: (remote === null || remote === void 0 ? void 0 : remote.orgName) || (local === null || local === void 0 ? void 0 : local.info.author.name) || '',
        popularity: (remote === null || remote === void 0 ? void 0 : remote.popularity) || 0,
        publishedAt: (remote === null || remote === void 0 ? void 0 : remote.createdAt) || '',
        type,
        signature: getPluginSignature({ local, remote, error }),
        signatureOrg: (local === null || local === void 0 ? void 0 : local.signatureOrg) || (remote === null || remote === void 0 ? void 0 : remote.versionSignedByOrgName),
        signatureType: (local === null || local === void 0 ? void 0 : local.signatureType) || (remote === null || remote === void 0 ? void 0 : remote.versionSignatureType) || (remote === null || remote === void 0 ? void 0 : remote.signatureType) || undefined,
        // TODO<check if we would like to keep preferring the remote version>
        updatedAt: (remote === null || remote === void 0 ? void 0 : remote.updatedAt) || (local === null || local === void 0 ? void 0 : local.info.updated) || '',
        installedVersion,
        error: error === null || error === void 0 ? void 0 : error.errorCode,
        // Only local plugins have access control metadata
        accessControl: local === null || local === void 0 ? void 0 : local.accessControl,
        angularDetected: (local === null || local === void 0 ? void 0 : local.angularDetected) || (remote === null || remote === void 0 ? void 0 : remote.angularDetected),
    };
}
export const getExternalManageLink = (pluginId) => `${config.pluginCatalogURL}${pluginId}`;
export var Sorters;
(function (Sorters) {
    Sorters["nameAsc"] = "nameAsc";
    Sorters["nameDesc"] = "nameDesc";
    Sorters["updated"] = "updated";
    Sorters["published"] = "published";
    Sorters["downloads"] = "downloads";
})(Sorters || (Sorters = {}));
export const sortPlugins = (plugins, sortBy) => {
    const sorters = {
        nameAsc: (a, b) => a.name.localeCompare(b.name),
        nameDesc: (a, b) => b.name.localeCompare(a.name),
        updated: (a, b) => dateTimeParse(b.updatedAt).valueOf() - dateTimeParse(a.updatedAt).valueOf(),
        published: (a, b) => dateTimeParse(b.publishedAt).valueOf() - dateTimeParse(a.publishedAt).valueOf(),
        downloads: (a, b) => b.downloads - a.downloads,
    };
    if (sorters[sortBy]) {
        return plugins.sort(sorters[sortBy]);
    }
    return plugins;
};
function groupErrorsByPluginId(errors = []) {
    return errors.reduce((byId, error) => {
        byId[error.pluginId] = error;
        return byId;
    }, {});
}
function getPluginSignature(options) {
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
    if (local === null || local === void 0 ? void 0 : local.signature) {
        return local.signature;
    }
    if ((remote === null || remote === void 0 ? void 0 : remote.signatureType) && (remote === null || remote === void 0 ? void 0 : remote.versionSignatureType)) {
        return PluginSignatureStatus.valid;
    }
    return PluginSignatureStatus.missing;
}
// Updates the core Grafana config to have the correct list available panels
export const updatePanels = () => getBackendSrv()
    .get('/api/frontend/settings')
    .then((settings) => {
    config.panels = settings.panels;
});
export function getLatestCompatibleVersion(versions) {
    if (!versions) {
        return;
    }
    const [latest] = versions.filter((v) => Boolean(v.isCompatible));
    return latest;
}
export const isInstallControlsEnabled = () => config.pluginAdminEnabled;
export const hasInstallControlWarning = (plugin, isRemotePluginsAvailable, latestCompatibleVersion) => {
    const isExternallyManaged = config.pluginAdminExternalManageEnabled;
    const hasPermission = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
    const isCompatible = Boolean(latestCompatibleVersion);
    return (plugin.type === PluginType.renderer ||
        plugin.type === PluginType.secretsmanager ||
        (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) ||
        plugin.isDev ||
        (!hasPermission && !isExternallyManaged) ||
        !plugin.isPublished ||
        !isCompatible ||
        !isRemotePluginsAvailable);
};
export const isLocalPluginVisibleByConfig = (p) => isNotHiddenByConfig(p.id);
export const isRemotePluginVisibleByConfig = (p) => isNotHiddenByConfig(p.slug);
function isNotHiddenByConfig(id) {
    const { pluginCatalogHiddenPlugins } = config;
    return !pluginCatalogHiddenPlugins.includes(id);
}
function isDisabledSecretsPlugin(type) {
    return type === PluginType.secretsmanager && !config.secretsManagerPluginEnabled;
}
export function isLocalCorePlugin(local) {
    return Boolean((local === null || local === void 0 ? void 0 : local.signature) === 'internal');
}
//# sourceMappingURL=helpers.js.map