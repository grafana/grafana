import { __awaiter } from "tslib";
import { startMeasure, stopMeasure } from 'app/core/utils/metrics';
import * as pluginLoader from './plugin_loader';
export function preloadPlugins(apps = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        startMeasure('frontend_plugins_preload');
        const pluginsToPreload = Object.values(apps).filter((app) => app.preload);
        const result = yield Promise.all(pluginsToPreload.map(preload));
        stopMeasure('frontend_plugins_preload');
        return result;
    });
}
function preload(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { path, version, id: pluginId } = config;
        try {
            startMeasure(`frontend_plugin_preload_${pluginId}`);
            const { plugin } = yield pluginLoader.importPluginModule({
                path,
                version,
                isAngular: config.angularDetected,
                pluginId,
            });
            const { extensionConfigs = [] } = plugin;
            return { pluginId, extensionConfigs };
        }
        catch (error) {
            console.error(`[Plugins] Failed to preload plugin: ${path} (version: ${version})`, error);
            return { pluginId, extensionConfigs: [], error };
        }
        finally {
            stopMeasure(`frontend_plugin_preload_${pluginId}`);
        }
    });
}
//# sourceMappingURL=pluginPreloader.js.map