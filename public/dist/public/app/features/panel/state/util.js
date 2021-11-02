import { __values } from "tslib";
import { PluginState } from '@grafana/data';
import { config } from 'app/core/config';
export function getAllPanelPluginMeta() {
    var allPanels = config.panels;
    return Object.keys(allPanels)
        .filter(function (key) { return allPanels[key]['hideFromList'] === false; })
        .map(function (key) { return allPanels[key]; })
        .sort(function (a, b) { return a.sort - b.sort; });
}
export function filterPluginList(pluginsList, searchQuery, current) {
    var e_1, _a;
    if (!searchQuery.length) {
        return pluginsList.filter(function (p) {
            if (p.state === PluginState.deprecated) {
                return current.id === p.id;
            }
            return true;
        });
    }
    var query = searchQuery.toLowerCase();
    var first = [];
    var match = [];
    try {
        for (var pluginsList_1 = __values(pluginsList), pluginsList_1_1 = pluginsList_1.next(); !pluginsList_1_1.done; pluginsList_1_1 = pluginsList_1.next()) {
            var item = pluginsList_1_1.value;
            if (item.state === PluginState.deprecated && current.id !== item.id) {
                continue;
            }
            var name_1 = item.name.toLowerCase();
            var idx = name_1.indexOf(query);
            if (idx === 0) {
                first.push(item);
            }
            else if (idx > 0) {
                match.push(item);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (pluginsList_1_1 && !pluginsList_1_1.done && (_a = pluginsList_1.return)) _a.call(pluginsList_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return first.concat(match);
}
//# sourceMappingURL=util.js.map