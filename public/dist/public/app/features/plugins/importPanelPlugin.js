import { PanelPlugin } from '@grafana/data';
import config from 'app/core/config';
import { getPanelPluginLoadError } from '../panel/components/PanelPluginError';
import { importPluginModule } from './plugin_loader';
const promiseCache = {};
const panelPluginCache = {};
export function importPanelPlugin(id) {
    const loaded = promiseCache[id];
    if (loaded) {
        return loaded;
    }
    const meta = getPanelPluginMeta(id);
    if (!meta) {
        throw new Error(`Plugin ${id} not found`);
    }
    promiseCache[id] = getPanelPlugin(meta);
    if (id !== meta.type) {
        promiseCache[meta.type] = promiseCache[id];
    }
    return promiseCache[id];
}
export function hasPanelPlugin(id) {
    return !!getPanelPluginMeta(id);
}
export function getPanelPluginMeta(id) {
    var _a;
    const v = config.panels[id];
    if (!v) {
        // Check alias values before failing
        for (const p of Object.values(config.panels)) {
            if ((_a = p.aliasIDs) === null || _a === void 0 ? void 0 : _a.includes(id)) {
                return p;
            }
        }
    }
    return v;
}
export function importPanelPluginFromMeta(meta) {
    return getPanelPlugin(meta);
}
export function syncGetPanelPlugin(id) {
    return panelPluginCache[id];
}
function getPanelPlugin(meta) {
    var _a;
    return importPluginModule({
        path: meta.module,
        version: (_a = meta.info) === null || _a === void 0 ? void 0 : _a.version,
        isAngular: meta.angularDetected,
        pluginId: meta.id,
    })
        .then((pluginExports) => {
        if (pluginExports.plugin) {
            return pluginExports.plugin;
        }
        else if (pluginExports.PanelCtrl) {
            const plugin = new PanelPlugin(null);
            plugin.angularPanelCtrl = pluginExports.PanelCtrl;
            return plugin;
        }
        throw new Error('missing export: plugin or PanelCtrl');
    })
        .then((plugin) => {
        plugin.meta = meta;
        panelPluginCache[meta.id] = plugin;
        if (!plugin.panel && plugin.angularPanelCtrl) {
            plugin.panel = getAngularPanelReactWrapper(plugin);
        }
        return plugin;
    })
        .catch((err) => {
        // TODO, maybe a different error plugin
        console.warn('Error loading panel plugin: ' + meta.id, err);
        return getPanelPluginLoadError(meta, err);
    });
}
let getAngularPanelReactWrapper = (plugin) => null;
export function setAngularPanelReactWrapper(wrapper) {
    getAngularPanelReactWrapper = wrapper;
}
//# sourceMappingURL=importPanelPlugin.js.map