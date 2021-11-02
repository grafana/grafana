import { LegendDisplayMode } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';
import { PieChartLabels, PieChartType } from './types';
var PieChartSuggestionsSupplier = /** @class */ (function () {
    function PieChartSuggestionsSupplier() {
    }
    PieChartSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
        var list = builder.getListAppender({
            name: SuggestionName.PieChart,
            pluginId: 'piechart',
            options: {
                reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                },
                displayLabels: [PieChartLabels.Percent],
                legend: {
                    placement: 'right',
                    values: [],
                },
            },
            previewModifier: function (s) {
                // Hide labels in preview
                s.options.legend.displayMode = LegendDisplayMode.Hidden;
                s.options.displayLabels = [];
            },
        });
        var dataSummary = builder.dataSummary;
        if (!dataSummary.hasNumberField) {
            return;
        }
        if (dataSummary.hasStringField && dataSummary.frameCount === 1) {
            // if many values this or single value PieChart is not a good option
            if (dataSummary.rowCountTotal > 30 || dataSummary.rowCountTotal < 2) {
                return;
            }
            list.append({
                name: SuggestionName.PieChart,
                options: {
                    reduceOptions: {
                        values: true,
                        calcs: [],
                    },
                },
            });
            list.append({
                name: SuggestionName.PieChartDonut,
                options: {
                    reduceOptions: {
                        values: true,
                        calcs: [],
                    },
                    pieType: PieChartType.Donut,
                },
            });
            return;
        }
        if (dataSummary.numberFieldCount > 30 || dataSummary.numberFieldCount < 2) {
            return;
        }
        list.append({
            name: SuggestionName.PieChart,
        });
        list.append({
            name: SuggestionName.PieChartDonut,
            options: {
                pieType: PieChartType.Donut,
            },
        });
    };
    return PieChartSuggestionsSupplier;
}());
export { PieChartSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map