var TextPanelSuggestionSupplier = /** @class */ (function () {
    function TextPanelSuggestionSupplier() {
    }
    TextPanelSuggestionSupplier.prototype.getSuggestionsForData = function (builder) {
        var dataSummary = builder.dataSummary;
        if (dataSummary.hasData) {
            return;
        }
        var list = builder.getListAppender({
            name: 'Text panel',
            pluginId: 'text',
            options: {
                content: "\n# Title\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n* First item\n* Second item\n* Third item",
            },
        });
        list.append({});
    };
    return TextPanelSuggestionSupplier;
}());
export { TextPanelSuggestionSupplier };
//# sourceMappingURL=suggestions.js.map