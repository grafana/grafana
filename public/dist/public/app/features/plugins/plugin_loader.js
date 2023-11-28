import { __awaiter } from "tslib";
import { AppPlugin, DataSourcePlugin, } from '@grafana/data';
import { SystemJS } from '@grafana/runtime';
import builtInPlugins from './built_in_plugins';
import { registerPluginInCache } from './loader/cache';
import { sharedDependenciesMap } from './loader/sharedDependencies';
import { decorateSystemJSFetch, decorateSystemJSResolve, decorateSystemJsOnload } from './loader/systemjsHooks';
import { buildImportMap } from './loader/utils';
import { importPluginModuleInSandbox } from './sandbox/sandbox_plugin_loader';
import { isFrontendSandboxSupported } from './sandbox/utils';
const imports = buildImportMap(sharedDependenciesMap);
SystemJS.addImportMap({ imports });
const systemJSPrototype = SystemJS.constructor.prototype;
// Monaco Editors reliance on RequireJS means we need to transform
// the content of the plugin code at runtime which can only be done with fetch/eval.
systemJSPrototype.shouldFetch = () => true;
const systemJSFetch = systemJSPrototype.fetch;
systemJSPrototype.fetch = function (url, options) {
    return decorateSystemJSFetch(systemJSFetch, url, options);
};
const systemJSResolve = systemJSPrototype.resolve;
systemJSPrototype.resolve = decorateSystemJSResolve.bind(systemJSPrototype, systemJSResolve);
// Older plugins load .css files which resolves to a CSS Module.
// https://github.com/WICG/webcomponents/blob/gh-pages/proposals/css-modules-v1-explainer.md#importing-a-css-module
// Any css files loaded via SystemJS have their styles applied onload.
systemJSPrototype.onload = decorateSystemJsOnload;
export function importPluginModule({ path, version, isAngular, pluginId, }) {
    return __awaiter(this, void 0, void 0, function* () {
        if (version) {
            registerPluginInCache({ path, version });
        }
        const builtIn = builtInPlugins[path];
        if (builtIn) {
            // for handling dynamic imports
            if (typeof builtIn === 'function') {
                return yield builtIn();
            }
            else {
                return builtIn;
            }
        }
        // the sandboxing environment code cannot work in nodejs and requires a real browser
        if (isFrontendSandboxSupported({ isAngular, pluginId })) {
            return importPluginModuleInSandbox({ pluginId });
        }
        return SystemJS.import(path);
    });
}
export function importDataSourcePlugin(meta) {
    var _a;
    return importPluginModule({
        path: meta.module,
        version: (_a = meta.info) === null || _a === void 0 ? void 0 : _a.version,
        isAngular: meta.angularDetected,
        pluginId: meta.id,
    }).then((pluginExports) => {
        if (pluginExports.plugin) {
            const dsPlugin = pluginExports.plugin;
            dsPlugin.meta = meta;
            return dsPlugin;
        }
        if (pluginExports.Datasource) {
            const dsPlugin = new DataSourcePlugin(pluginExports.Datasource);
            dsPlugin.setComponentsFromLegacyExports(pluginExports);
            dsPlugin.meta = meta;
            return dsPlugin;
        }
        throw new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export');
    });
}
export function importAppPlugin(meta) {
    var _a;
    return importPluginModule({
        path: meta.module,
        version: (_a = meta.info) === null || _a === void 0 ? void 0 : _a.version,
        isAngular: meta.angularDetected,
        pluginId: meta.id,
    }).then((pluginExports) => {
        const plugin = pluginExports.plugin ? pluginExports.plugin : new AppPlugin();
        plugin.init(meta);
        plugin.meta = meta;
        plugin.setComponentsFromLegacyExports(pluginExports);
        return plugin;
    });
}
//# sourceMappingURL=plugin_loader.js.map