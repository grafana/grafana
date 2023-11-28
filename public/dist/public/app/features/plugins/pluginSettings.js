import { getBackendSrv } from '@grafana/runtime';
const pluginInfoCache = {};
export function getPluginSettings(pluginId, options) {
    const v = pluginInfoCache[pluginId];
    if (v) {
        return Promise.resolve(v);
    }
    return getBackendSrv()
        .get(`/api/plugins/${pluginId}/settings`, undefined, undefined, options)
        .then((settings) => {
        pluginInfoCache[pluginId] = settings;
        return settings;
    })
        .catch((err) => {
        return Promise.reject(new Error('Unknown Plugin'));
    });
}
export const clearPluginSettingsCache = (pluginId) => {
    if (pluginId) {
        return delete pluginInfoCache[pluginId];
    }
    // clear all
    return Object.keys(pluginInfoCache).forEach((key) => delete pluginInfoCache[key]);
};
//# sourceMappingURL=pluginSettings.js.map