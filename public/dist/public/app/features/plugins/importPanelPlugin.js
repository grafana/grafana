import config from 'app/core/config';
import * as grafanaData from '@grafana/data';
import { getPanelPluginLoadError } from '../panel/components/PanelPluginError';
import { importPluginModule } from './plugin_loader';
var panelCache = {};
export function importPanelPlugin(id) {
    var loaded = panelCache[id];
    if (loaded) {
        return loaded;
    }
    var meta = config.panels[id];
    if (!meta) {
        throw new Error("Plugin " + id + " not found");
    }
    panelCache[id] = getPanelPlugin(meta);
    return panelCache[id];
}
export function importPanelPluginFromMeta(meta) {
    return getPanelPlugin(meta);
}
function getPanelPlugin(meta) {
    return importPluginModule(meta.module)
        .then(function (pluginExports) {
        if (pluginExports.plugin) {
            return pluginExports.plugin;
        }
        else if (pluginExports.PanelCtrl) {
            var plugin = new grafanaData.PanelPlugin(null);
            plugin.angularPanelCtrl = pluginExports.PanelCtrl;
            return plugin;
        }
        throw new Error('missing export: plugin or PanelCtrl');
    })
        .then(function (plugin) {
        plugin.meta = meta;
        return plugin;
    })
        .catch(function (err) {
        // TODO, maybe a different error plugin
        console.warn('Error loading panel plugin: ' + meta.id, err);
        return getPanelPluginLoadError(meta, err);
    });
}
//# sourceMappingURL=importPanelPlugin.js.map