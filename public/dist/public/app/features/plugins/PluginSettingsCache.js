import { getBackendSrv } from '@grafana/runtime';
var pluginInfoCache = {};
export function getPluginSettings(pluginId) {
    var v = pluginInfoCache[pluginId];
    if (v) {
        return Promise.resolve(v);
    }
    return getBackendSrv()
        .get("/api/plugins/" + pluginId + "/settings")
        .then(function (settings) {
        pluginInfoCache[pluginId] = settings;
        return settings;
    })
        .catch(function (err) {
        return Promise.reject(new Error('Unknown Plugin'));
    });
}
//# sourceMappingURL=PluginSettingsCache.js.map