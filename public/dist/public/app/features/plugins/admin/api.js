import { __assign, __awaiter, __generator, __read } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { renderMarkdown } from '@grafana/data';
import { API_ROOT, GRAFANA_API_ROOT } from './constants';
import { mergeLocalAndRemote } from './helpers';
export function getCatalogPlugin(id) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, local, remote;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getPlugin(id)];
                case 1:
                    _a = _b.sent(), local = _a.local, remote = _a.remote;
                    return [2 /*return*/, mergeLocalAndRemote(local, remote)];
            }
        });
    });
}
export function getPluginDetails(id) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var localPlugins, local, isInstalled, _c, remote, versions, localReadme, dependencies, grafanaDependency;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, getLocalPlugins()];
                case 1:
                    localPlugins = _d.sent();
                    local = localPlugins.find(function (p) { return p.id === id; });
                    isInstalled = Boolean(local);
                    return [4 /*yield*/, Promise.all([
                            getRemotePlugin(id, isInstalled),
                            getPluginVersions(id),
                            getLocalPluginReadme(id),
                        ])];
                case 2:
                    _c = __read.apply(void 0, [_d.sent(), 3]), remote = _c[0], versions = _c[1], localReadme = _c[2];
                    dependencies = (_a = remote === null || remote === void 0 ? void 0 : remote.json) === null || _a === void 0 ? void 0 : _a.dependencies;
                    grafanaDependency = (dependencies === null || dependencies === void 0 ? void 0 : dependencies.grafanaDependency)
                        ? dependencies === null || dependencies === void 0 ? void 0 : dependencies.grafanaDependency
                        : (dependencies === null || dependencies === void 0 ? void 0 : dependencies.grafanaVersion)
                            ? ">=" + (dependencies === null || dependencies === void 0 ? void 0 : dependencies.grafanaVersion)
                            : '';
                    return [2 /*return*/, {
                            grafanaDependency: grafanaDependency,
                            pluginDependencies: (dependencies === null || dependencies === void 0 ? void 0 : dependencies.plugins) || [],
                            links: ((_b = remote === null || remote === void 0 ? void 0 : remote.json) === null || _b === void 0 ? void 0 : _b.info.links) || (local === null || local === void 0 ? void 0 : local.info.links) || [],
                            readme: localReadme || (remote === null || remote === void 0 ? void 0 : remote.readme),
                            versions: versions,
                        }];
            }
        });
    });
}
export function getRemotePlugins() {
    return __awaiter(this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get(GRAFANA_API_ROOT + "/plugins")];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.items];
            }
        });
    });
}
function getPlugin(slug) {
    return __awaiter(this, void 0, void 0, function () {
        var installed, localPlugin, _a, remote, versions;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getLocalPlugins()];
                case 1:
                    installed = _b.sent();
                    localPlugin = installed === null || installed === void 0 ? void 0 : installed.find(function (plugin) {
                        return plugin.id === slug;
                    });
                    return [4 /*yield*/, Promise.all([getRemotePlugin(slug, Boolean(localPlugin)), getPluginVersions(slug)])];
                case 2:
                    _a = __read.apply(void 0, [_b.sent(), 2]), remote = _a[0], versions = _a[1];
                    return [2 /*return*/, {
                            remote: remote,
                            remoteVersions: versions,
                            local: localPlugin,
                        }];
            }
        });
    });
}
export function getPluginErrors() {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().get(API_ROOT + "/errors")];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getRemotePlugin(id, isInstalled) {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().get(GRAFANA_API_ROOT + "/plugins/" + id, {})];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_2 = _a.sent();
                    // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
                    error_2.isHandled = true;
                    return [2 /*return*/];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getPluginVersions(id) {
    return __awaiter(this, void 0, void 0, function () {
        var versions, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().get(GRAFANA_API_ROOT + "/plugins/" + id + "/versions")];
                case 1:
                    versions = _a.sent();
                    return [2 /*return*/, (versions.items || []).map(function (_a) {
                            var version = _a.version, createdAt = _a.createdAt;
                            return ({ version: version, createdAt: createdAt });
                        })];
                case 2:
                    error_3 = _a.sent();
                    // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
                    error_3.isHandled = true;
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getLocalPluginReadme(id) {
    return __awaiter(this, void 0, void 0, function () {
        var markdown, markdownAsHtml, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().get(API_ROOT + "/" + id + "/markdown/help")];
                case 1:
                    markdown = _a.sent();
                    markdownAsHtml = markdown ? renderMarkdown(markdown) : '';
                    return [2 /*return*/, markdownAsHtml];
                case 2:
                    error_4 = _a.sent();
                    error_4.isHandled = true;
                    return [2 /*return*/, ''];
                case 3: return [2 /*return*/];
            }
        });
    });
}
export function getLocalPlugins() {
    return __awaiter(this, void 0, void 0, function () {
        var installed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("" + API_ROOT, { embedded: 0 })];
                case 1:
                    installed = _a.sent();
                    return [2 /*return*/, installed];
            }
        });
    });
}
function getOrg(slug) {
    return __awaiter(this, void 0, void 0, function () {
        var org;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get(GRAFANA_API_ROOT + "/orgs/" + slug)];
                case 1:
                    org = _a.sent();
                    return [2 /*return*/, __assign(__assign({}, org), { avatarUrl: GRAFANA_API_ROOT + "/orgs/" + slug + "/avatar" })];
            }
        });
    });
}
export function installPlugin(id, version) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post(API_ROOT + "/" + id + "/install", {
                        version: version,
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function uninstallPlugin(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post(API_ROOT + "/" + id + "/uninstall")];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export var api = {
    getRemotePlugins: getRemotePlugins,
    getPlugin: getPlugin,
    getInstalledPlugins: getLocalPlugins,
    getOrg: getOrg,
    installPlugin: installPlugin,
    uninstallPlugin: uninstallPlugin,
};
//# sourceMappingURL=api.js.map