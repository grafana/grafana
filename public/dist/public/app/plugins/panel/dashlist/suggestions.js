var DashListSuggestionsSupplier = /** @class */ (function () {
    function DashListSuggestionsSupplier() {
    }
    DashListSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
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
    return DashListSuggestionsSupplier;
}());
export { DashListSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map