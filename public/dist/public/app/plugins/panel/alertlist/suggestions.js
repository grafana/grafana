export class AlertListSuggestionsSupplier {
    getSuggestionsForData(builder) {
        const { dataSummary } = builder;
        if (dataSummary.hasData) {
            return;
        }
        const list = builder.getListAppender({
            name: 'Dashboard list',
            pluginId: 'dashlist',
            options: {},
        });
        list.append({});
    }
}
//# sourceMappingURL=suggestions.js.map