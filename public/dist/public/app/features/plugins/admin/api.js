import { __awaiter } from "tslib";
import { renderMarkdown } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { API_ROOT, GCOM_API_ROOT } from './constants';
import { isLocalPluginVisibleByConfig, isRemotePluginVisibleByConfig } from './helpers';
export function getPluginDetails(id) {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        const remote = yield getRemotePlugin(id);
        const isPublished = Boolean(remote);
        const [localPlugins, versions, localReadme] = yield Promise.all([
            getLocalPlugins(),
            getPluginVersions(id, isPublished),
            getLocalPluginReadme(id),
        ]);
        const local = localPlugins.find((p) => p.id === id);
        const dependencies = (local === null || local === void 0 ? void 0 : local.dependencies) || ((_a = remote === null || remote === void 0 ? void 0 : remote.json) === null || _a === void 0 ? void 0 : _a.dependencies);
        return {
            grafanaDependency: (_c = (_b = dependencies === null || dependencies === void 0 ? void 0 : dependencies.grafanaDependency) !== null && _b !== void 0 ? _b : dependencies === null || dependencies === void 0 ? void 0 : dependencies.grafanaVersion) !== null && _c !== void 0 ? _c : '',
            pluginDependencies: (dependencies === null || dependencies === void 0 ? void 0 : dependencies.plugins) || [],
            links: (local === null || local === void 0 ? void 0 : local.info.links) || ((_d = remote === null || remote === void 0 ? void 0 : remote.json) === null || _d === void 0 ? void 0 : _d.info.links) || [],
            readme: localReadme || (remote === null || remote === void 0 ? void 0 : remote.readme),
            versions,
            statusContext: (_e = remote === null || remote === void 0 ? void 0 : remote.statusContext) !== null && _e !== void 0 ? _e : '',
        };
    });
}
export function getRemotePlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        // We are also fetching deprecated plugins, because we would like to be able to label plugins in the list that are both installed and deprecated.
        // (We won't show not installed deprecated plugins in the list)
        const { items: remotePlugins } = yield getBackendSrv().get(`${GCOM_API_ROOT}/plugins`, {
            includeDeprecated: true,
        });
        return remotePlugins.filter(isRemotePluginVisibleByConfig);
    });
}
export function getPluginErrors() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield getBackendSrv().get(`${API_ROOT}/errors`);
        }
        catch (error) {
            return [];
        }
    });
}
function getRemotePlugin(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield getBackendSrv().get(`${GCOM_API_ROOT}/plugins/${id}`, {});
        }
        catch (error) {
            if (isFetchError(error)) {
                // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
                error.isHandled = true;
            }
            return;
        }
    });
}
function getPluginVersions(id, isPublished) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!isPublished) {
                return [];
            }
            const versions = yield getBackendSrv().get(`${GCOM_API_ROOT}/plugins/${id}/versions`);
            return (versions.items || []).map((v) => ({
                version: v.version,
                createdAt: v.createdAt,
                isCompatible: v.isCompatible,
                grafanaDependency: v.grafanaDependency,
            }));
        }
        catch (error) {
            if (isFetchError(error)) {
                // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
                error.isHandled = true;
            }
            return [];
        }
    });
}
function getLocalPluginReadme(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const markdown = yield getBackendSrv().get(`${API_ROOT}/${id}/markdown/README`);
            const markdownAsHtml = markdown ? renderMarkdown(markdown) : '';
            return markdownAsHtml;
        }
        catch (error) {
            if (isFetchError(error)) {
                error.isHandled = true;
            }
            return '';
        }
    });
}
export function getLocalPlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        const localPlugins = yield getBackendSrv().get(`${API_ROOT}`, accessControlQueryParam({ embedded: 0 }));
        return localPlugins.filter(isLocalPluginVisibleByConfig);
    });
}
export function installPlugin(id) {
    return __awaiter(this, void 0, void 0, function* () {
        // This will install the latest compatible version based on the logic
        // on the backend.
        return yield getBackendSrv().post(`${API_ROOT}/${id}/install`, undefined, {
            // Error is displayed in the page
            showErrorAlert: false,
        });
    });
}
export function uninstallPlugin(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getBackendSrv().post(`${API_ROOT}/${id}/uninstall`);
    });
}
export function updatePluginSettings(id, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield getBackendSrv().datasourceRequest({
            url: `/api/plugins/${id}/settings`,
            method: 'POST',
            data,
        });
        return response === null || response === void 0 ? void 0 : response.data;
    });
}
export const api = {
    getRemotePlugins,
    getInstalledPlugins: getLocalPlugins,
    installPlugin,
    uninstallPlugin,
};
//# sourceMappingURL=api.js.map