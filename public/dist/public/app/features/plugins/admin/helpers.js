import { config } from '@grafana/runtime';
import { gt } from 'semver';
import { PluginSignatureStatus, dateTimeParse } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';
export function mergeLocalsAndRemotes(local, remote, errors) {
    if (local === void 0) { local = []; }
    if (remote === void 0) { remote = []; }
    var catalogPlugins = [];
    var errorByPluginId = groupErrorsByPluginId(errors);
    // add locals
    local.forEach(function (l) {
        var remotePlugin = remote.find(function (r) { return r.slug === l.id; });
        var error = errorByPluginId[l.id];
        if (!remotePlugin) {
            catalogPlugins.push(mergeLocalAndRemote(l, undefined, error));
        }
    });
    // add remote
    remote.forEach(function (r) {
        var localPlugin = local.find(function (l) { return l.id === r.slug; });
        var error = errorByPluginId[r.slug];
        catalogPlugins.push(mergeLocalAndRemote(localPlugin, r, error));
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
    var name = plugin.name, id = plugin.slug, description = plugin.description, version = plugin.version, orgName = plugin.orgName, popularity = plugin.popularity, downloads = plugin.downloads, typeCode = plugin.typeCode, updatedAt = plugin.updatedAt, publishedAt = plugin.createdAt, status = plugin.status, versionSignatureType = plugin.versionSignatureType, signatureType = plugin.signatureType;
    var hasSignature = signatureType !== '' || versionSignatureType !== '';
    var isDisabled = !!error;
    var catalogPlugin = {
        description: description,
        downloads: downloads,
        id: id,
        info: {
            logos: {
                small: "https://grafana.com/api/plugins/" + id + "/versions/" + version + "/logos/small",
                large: "https://grafana.com/api/plugins/" + id + "/versions/" + version + "/logos/large",
            },
        },
        name: name,
        orgName: orgName,
        popularity: popularity,
        publishedAt: publishedAt,
        signature: hasSignature ? PluginSignatureStatus.valid : PluginSignatureStatus.missing,
        updatedAt: updatedAt,
        version: version,
        hasUpdate: false,
        isInstalled: isDisabled,
        isDisabled: isDisabled,
        isCore: plugin.internal,
        isDev: false,
        isEnterprise: status === 'enterprise',
        type: typeCode,
        error: error === null || error === void 0 ? void 0 : error.errorCode,
    };
    return catalogPlugin;
}
export function mapLocalToCatalog(plugin, error) {
    var name = plugin.name, _a = plugin.info, description = _a.description, version = _a.version, logos = _a.logos, updated = _a.updated, author = _a.author, id = plugin.id, signature = plugin.signature, dev = plugin.dev, type = plugin.type, signatureOrg = plugin.signatureOrg, signatureType = plugin.signatureType;
    return {
        description: description,
        downloads: 0,
        id: id,
        info: { logos: logos },
        name: name,
        orgName: author.name,
        popularity: 0,
        publishedAt: '',
        signature: signature,
        signatureOrg: signatureOrg,
        signatureType: signatureType,
        updatedAt: updated,
        version: version,
        hasUpdate: false,
        isInstalled: true,
        isDisabled: !!error,
        isCore: signature === 'internal',
        isDev: Boolean(dev),
        isEnterprise: false,
        type: type,
        error: error === null || error === void 0 ? void 0 : error.errorCode,
    };
}
export function mapToCatalogPlugin(local, remote, error) {
    var version = (remote === null || remote === void 0 ? void 0 : remote.version) || (local === null || local === void 0 ? void 0 : local.info.version) || '';
    var hasUpdate = (local === null || local === void 0 ? void 0 : local.hasUpdate) || Boolean((remote === null || remote === void 0 ? void 0 : remote.version) && (local === null || local === void 0 ? void 0 : local.info.version) && gt(remote === null || remote === void 0 ? void 0 : remote.version, local === null || local === void 0 ? void 0 : local.info.version));
    var id = (remote === null || remote === void 0 ? void 0 : remote.slug) || (local === null || local === void 0 ? void 0 : local.id) || '';
    var hasRemoteSignature = (remote === null || remote === void 0 ? void 0 : remote.signatureType) || (remote === null || remote === void 0 ? void 0 : remote.versionSignatureType);
    var isDisabled = !!error;
    var logos = {
        small: 'https://grafana.com/api/plugins/404notfound/versions/none/logos/small',
        large: 'https://grafana.com/api/plugins/404notfound/versions/none/logos/large',
    };
    if (remote) {
        logos = {
            small: "https://grafana.com/api/plugins/" + id + "/versions/" + version + "/logos/small",
            large: "https://grafana.com/api/plugins/" + id + "/versions/" + version + "/logos/large",
        };
    }
    else if (local && local.info.logos) {
        logos = local.info.logos;
    }
    return {
        description: (remote === null || remote === void 0 ? void 0 : remote.description) || (local === null || local === void 0 ? void 0 : local.info.description) || '',
        downloads: (remote === null || remote === void 0 ? void 0 : remote.downloads) || 0,
        hasUpdate: hasUpdate,
        id: id,
        info: {
            logos: logos,
        },
        isCore: Boolean((remote === null || remote === void 0 ? void 0 : remote.internal) || (local === null || local === void 0 ? void 0 : local.signature) === PluginSignatureStatus.internal),
        isDev: Boolean(local === null || local === void 0 ? void 0 : local.dev),
        isEnterprise: (remote === null || remote === void 0 ? void 0 : remote.status) === 'enterprise',
        isInstalled: Boolean(local) || isDisabled,
        isDisabled: isDisabled,
        name: (remote === null || remote === void 0 ? void 0 : remote.name) || (local === null || local === void 0 ? void 0 : local.name) || '',
        orgName: (remote === null || remote === void 0 ? void 0 : remote.orgName) || (local === null || local === void 0 ? void 0 : local.info.author.name) || '',
        popularity: (remote === null || remote === void 0 ? void 0 : remote.popularity) || 0,
        publishedAt: (remote === null || remote === void 0 ? void 0 : remote.createdAt) || '',
        type: (remote === null || remote === void 0 ? void 0 : remote.typeCode) || (local === null || local === void 0 ? void 0 : local.type),
        signature: (local === null || local === void 0 ? void 0 : local.signature) || (hasRemoteSignature ? PluginSignatureStatus.valid : PluginSignatureStatus.missing),
        signatureOrg: (local === null || local === void 0 ? void 0 : local.signatureOrg) || (remote === null || remote === void 0 ? void 0 : remote.versionSignedByOrgName),
        signatureType: (local === null || local === void 0 ? void 0 : local.signatureType) || (remote === null || remote === void 0 ? void 0 : remote.versionSignatureType) || (remote === null || remote === void 0 ? void 0 : remote.signatureType) || undefined,
        updatedAt: (remote === null || remote === void 0 ? void 0 : remote.updatedAt) || (local === null || local === void 0 ? void 0 : local.info.updated) || '',
        version: version,
        error: error === null || error === void 0 ? void 0 : error.errorCode,
    };
}
export var getExternalManageLink = function (pluginId) { return "" + config.pluginCatalogURL + pluginId; };
export var Sorters;
(function (Sorters) {
    Sorters["nameAsc"] = "nameAsc";
    Sorters["nameDesc"] = "nameDesc";
    Sorters["updated"] = "updated";
    Sorters["published"] = "published";
    Sorters["downloads"] = "downloads";
})(Sorters || (Sorters = {}));
export var sortPlugins = function (plugins, sortBy) {
    var sorters = {
        nameAsc: function (a, b) { return a.name.localeCompare(b.name); },
        nameDesc: function (a, b) { return b.name.localeCompare(a.name); },
        updated: function (a, b) {
            return dateTimeParse(b.updatedAt).valueOf() - dateTimeParse(a.updatedAt).valueOf();
        },
        published: function (a, b) {
            return dateTimeParse(b.publishedAt).valueOf() - dateTimeParse(a.publishedAt).valueOf();
        },
        downloads: function (a, b) { return b.downloads - a.downloads; },
    };
    if (sorters[sortBy]) {
        return plugins.sort(sorters[sortBy]);
    }
    return plugins;
};
function groupErrorsByPluginId(errors) {
    if (errors === void 0) { errors = []; }
    return errors.reduce(function (byId, error) {
        byId[error.pluginId] = error;
        return byId;
    }, {});
}
// Updates the core Grafana config to have the correct list available panels
export var updatePanels = function () {
    return getBackendSrv()
        .get('/api/frontend/settings')
        .then(function (settings) {
        config.panels = settings.panels;
    });
};
//# sourceMappingURL=helpers.js.map