import { PluginState, unEscapeStringFromRegex } from '@grafana/data';
import { config } from 'app/core/config';
export function getAllPanelPluginMeta() {
    const allPanels = config.panels;
    return Object.keys(allPanels)
        .filter((key) => allPanels[key]['hideFromList'] === false)
        .map((key) => allPanels[key])
        .sort((a, b) => a.sort - b.sort);
}
export function getWidgetPluginMeta() {
    return getAllPanelPluginMeta().filter((panel) => !!panel.skipDataQuery);
}
export function getVizPluginMeta() {
    return getAllPanelPluginMeta().filter((panel) => !panel.skipDataQuery);
}
export function filterPluginList(pluginsList, searchQuery, // Note: this will be an escaped regex string as it comes from `FilterInput`
current) {
    if (!searchQuery.length) {
        return pluginsList.filter((p) => {
            if (p.state === PluginState.deprecated) {
                return (current === null || current === void 0 ? void 0 : current.id) === p.id;
            }
            return true;
        });
    }
    const query = unEscapeStringFromRegex(searchQuery).toLowerCase();
    const first = [];
    const match = [];
    const isGraphQuery = 'graph'.startsWith(query);
    for (const item of pluginsList) {
        if (item.state === PluginState.deprecated && (current === null || current === void 0 ? void 0 : current.id) !== item.id) {
            continue;
        }
        const name = item.name.toLowerCase();
        const idx = name.indexOf(query);
        if (idx === 0) {
            first.push(item);
        }
        else if (idx > 0) {
            match.push(item);
        }
        else if (isGraphQuery && item.id === 'timeseries') {
            first.push(item);
        }
    }
    return first.concat(match);
}
//# sourceMappingURL=util.js.map