import { SuggestionName } from 'app/types/suggestions';
var StatTimelineSuggestionsSupplier = /** @class */ (function () {
    function StatTimelineSuggestionsSupplier() {
    }
    StatTimelineSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
        var dataSummary = builder.dataSummary;
        if (!dataSummary.hasData) {
            return;
        }
        // This panel needs a time field and a string or number field
        if (!dataSummary.hasTimeField || (!dataSummary.hasStringField && !dataSummary.hasNumberField)) {
            return;
        }
        // If there are many series then they won't fit on y-axis so this panel is not good fit
        if (dataSummary.numberFieldCount >= 30) {
            return;
        }
        var list = builder.getListAppender({
            name: '',
            pluginId: 'state-timeline',
            options: {},
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
            previewModifier: function (s) { },
        });
        list.append({ name: SuggestionName.StateTimeline });
    };
    return StatTimelineSuggestionsSupplier;
}());
export { StatTimelineSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map