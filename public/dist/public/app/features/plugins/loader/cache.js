import { clearPluginSettingsCache } from '../pluginSettings';
const cache = {};
const initializedAt = Date.now();
export function registerPluginInCache({ path, version }) {
    const key = extractPath(path);
    if (key && !cache[key]) {
        cache[key] = encodeURI(version);
    }
}
export function invalidatePluginInCache(pluginId) {
    const path = `plugins/${pluginId}/module`;
    if (cache[path]) {
        delete cache[path];
    }
    clearPluginSettingsCache(pluginId);
}
export function resolveWithCache(url, defaultBust = initializedAt) {
    const path = extractPath(url);
    if (!path) {
        return `${url}?_cache=${defaultBust}`;
    }
    const version = cache[path];
    const bust = version || defaultBust;
    return `${url}?_cache=${bust}`;
}
function extractPath(address) {
    const match = /\/.+\/(plugins\/.+\/module)\.js/i.exec(address);
    if (!match) {
        return;
    }
    const [_, path] = match;
    if (!path) {
        return;
    }
    return path;
}
//# sourceMappingURL=cache.js.map