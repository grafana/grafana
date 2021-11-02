import { VizOrientation } from '@grafana/data';
import { LegendDisplayMode, StackingMode, VisibilityMode } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';
var BarChartSuggestionsSupplier = /** @class */ (function () {
    function BarChartSuggestionsSupplier() {
    }
    BarChartSuggestionsSupplier.prototype.getListWithDefaults = function (builder) {
        return builder.getListAppender({
            name: SuggestionName.BarChart,
            pluginId: 'barchart',
            options: {
                showValue: VisibilityMode.Never,
                legend: {
                    displayMode: LegendDisplayMode.Hidden,
                    placement: 'right',
                },
            },
            fieldConfig: {
                defaults: {
                    unit: 'short',
                    custom: {},
                },
                overrides: [],
            },
            previewModifier: function (s) {
                s.options.barWidth = 0.8;
            },
        });
    };
    BarChartSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
        var list = this.getListWithDefaults(builder);
        var dataSummary = builder.dataSummary;
        if (dataSummary.frameCount !== 1) {
            return;
        }
        if (!dataSummary.hasNumberField || !dataSummary.hasStringField) {
            return;
        }
        // if you have this many rows barchart might not be a good fit
        if (dataSummary.rowCountTotal > 50) {
            return;
        }
        // Vertical bars
        list.append({
            name: SuggestionName.BarChart,
        });
        if (dataSummary.numberFieldCount > 1) {
            list.append({
                name: SuggestionName.BarChartStacked,
                options: {
                    stacking: StackingMode.Normal,
                },
            });
            list.append({
                name: SuggestionName.BarChartStackedPercent,
                options: {
                    stacking: StackingMode.Percent,
                },
            });
        }
        // horizontal bars
        list.append({
            name: SuggestionName.BarChartHorizontal,
            options: {
                orientation: VizOrientation.Horizontal,
            },
        });
        if (dataSummary.numberFieldCount > 1) {
            list.append({
                name: SuggestionName.BarChartHorizontalStacked,
                options: {
                    stacking: StackingMode.Normal,
                    orientation: VizOrientation.Horizontal,
                },
            });
            list.append({
                name: SuggestionName.BarChartHorizontalStackedPercent,
                options: {
                    orientation: VizOrientation.Horizontal,
                    stacking: StackingMode.Percent,
                },
            });
        }
    };
    return BarChartSuggestionsSupplier;
}());
export { BarChartSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map