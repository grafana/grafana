import { BigValueColorMode, BigValueGraphMode } from '@grafana/ui';
import { SuggestionName } from 'app/types/suggestions';
var StatSuggestionsSupplier = /** @class */ (function () {
    function StatSuggestionsSupplier() {
    }
    StatSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
        var dataSummary = builder.dataSummary;
        if (!dataSummary.hasData) {
            return;
        }
        var list = builder.getListAppender({
            name: SuggestionName.Stat,
            pluginId: 'stat',
            options: {},
            fieldConfig: {
                defaults: {
                    unit: 'short',
                    custom: {},
                },
                overrides: [],
            },
            previewModifier: function (s) {
                if (s.options.reduceOptions.values) {
                    s.options.reduceOptions.limit = 1;
                }
            },
        });
        if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
            list.append({
                name: SuggestionName.Stat,
                options: {
                    reduceOptions: {
                        values: true,
                        calcs: [],
                        fields: dataSummary.hasNumberField ? undefined : '/.*/',
                    },
                },
            });
            list.append({
                name: SuggestionName.StatColoredBackground,
                options: {
                    reduceOptions: {
                        values: true,
                        calcs: [],
                        fields: dataSummary.hasNumberField ? undefined : '/.*/',
                    },
                    colorMode: BigValueColorMode.Background,
                },
            });
        }
        else if (dataSummary.hasNumberField) {
            list.append({
                options: {
                    reduceOptions: {
                        values: false,
                        calcs: ['lastNotNull'],
                    },
                },
            });
            list.append({
                name: SuggestionName.StatColoredBackground,
                options: {
                    reduceOptions: {
                        values: false,
                        calcs: ['lastNotNull'],
                    },
                    graphMode: BigValueGraphMode.None,
                    colorMode: BigValueColorMode.Background,
                },
            });
        }
    };
    return StatSuggestionsSupplier;
}());
export { StatSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map