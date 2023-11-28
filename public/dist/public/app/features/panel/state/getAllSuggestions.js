import { __awaiter } from "tslib";
import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
export const panelsToCheckFirst = [
    'timeseries',
    'barchart',
    'gauge',
    'stat',
    'piechart',
    'bargauge',
    'table',
    'state-timeline',
    'status-history',
    'logs',
    'candlestick',
    'flamegraph',
];
export function getAllSuggestions(data, panel) {
    return __awaiter(this, void 0, void 0, function* () {
        const builder = new VisualizationSuggestionsBuilder(data, panel);
        for (const pluginId of panelsToCheckFirst) {
            const plugin = yield importPanelPlugin(pluginId);
            const supplier = plugin.getSuggestionsSupplier();
            if (supplier) {
                supplier.getSuggestionsForData(builder);
            }
        }
        const list = builder.getList();
        if (!config.featureToggles.vizAndWidgetSplit && builder.dataSummary.fieldCount === 0) {
            for (const plugin of Object.values(config.panels)) {
                if (!plugin.skipDataQuery || plugin.hideFromList) {
                    continue;
                }
                list.push({
                    name: plugin.name,
                    pluginId: plugin.id,
                    description: plugin.info.description,
                    cardOptions: {
                        imgSrc: plugin.info.logos.small,
                    },
                });
            }
        }
        return list.sort((a, b) => {
            var _a, _b;
            if (builder.dataSummary.preferredVisualisationType) {
                if (a.pluginId === builder.dataSummary.preferredVisualisationType) {
                    return -1;
                }
                if (b.pluginId === builder.dataSummary.preferredVisualisationType) {
                    return 1;
                }
            }
            return ((_a = b.score) !== null && _a !== void 0 ? _a : VisualizationSuggestionScore.OK) - ((_b = a.score) !== null && _b !== void 0 ? _b : VisualizationSuggestionScore.OK);
        });
    });
}
//# sourceMappingURL=getAllSuggestions.js.map