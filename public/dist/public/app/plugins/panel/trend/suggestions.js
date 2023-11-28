import { GraphDrawStyle, LegendDisplayMode } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';
export class TrendSuggestionsSupplier {
    getSuggestionsForData(builder) {
        const { dataSummary } = builder;
        if (dataSummary.numberFieldCount < 2 || dataSummary.rowCountTotal < 2 || dataSummary.rowCountTotal < 2) {
            return;
        }
        // Super basic
        const list = builder.getListAppender({
            name: SuggestionName.LineChart,
            pluginId: 'trend',
            options: {
                legend: {
                    calcs: [],
                    displayMode: LegendDisplayMode.Hidden,
                    placement: 'right',
                    showLegend: false,
                },
            },
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
            cardOptions: {
                previewModifier: (s) => {
                    var _a, _b, _c;
                    if (((_b = (_a = s.fieldConfig) === null || _a === void 0 ? void 0 : _a.defaults.custom) === null || _b === void 0 ? void 0 : _b.drawStyle) !== GraphDrawStyle.Bars) {
                        s.fieldConfig.defaults.custom.lineWidth = Math.max((_c = s.fieldConfig.defaults.custom.lineWidth) !== null && _c !== void 0 ? _c : 1, 2);
                    }
                },
            },
        });
        return list;
    }
}
//# sourceMappingURL=suggestions.js.map