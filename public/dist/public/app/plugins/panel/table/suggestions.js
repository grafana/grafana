import { SuggestionName } from 'app/types/suggestions';
var TableSuggestionsSupplier = /** @class */ (function () {
    function TableSuggestionsSupplier() {
    }
    TableSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
        var list = builder.getListAppender({
            name: '',
            pluginId: 'table',
            options: {},
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
            previewModifier: function (s) { },
        });
        list.append({ name: SuggestionName.Table });
    };
    return TableSuggestionsSupplier;
}());
export { TableSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map