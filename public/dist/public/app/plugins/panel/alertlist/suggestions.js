var AlertListSuggestionsSupplier = /** @class */ (function () {
    function AlertListSuggestionsSupplier() {
    }
    AlertListSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
        var dataSummary = builder.dataSummary;
        if (dataSummary.hasData) {
            return;
        }
        var list = builder.getListAppender({
            name: 'Dashboard list',
            pluginId: 'dashlist',
            options: {},
        });
        list.append({});
    };
    return AlertListSuggestionsSupplier;
}());
export { AlertListSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map