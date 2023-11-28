import { SuggestionName } from 'app/types/suggestions';
export class TableSuggestionsSupplier {
    getSuggestionsForData(builder) {
        const list = builder.getListAppender({
            name: SuggestionName.Table,
            pluginId: 'table',
            options: {},
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
            cardOptions: {
                previewModifier: (s) => {
                    s.fieldConfig.defaults.custom.minWidth = 50;
                },
            },
        });
        // If there are not data suggest table anyway but use icon instead of real preview
        if (builder.dataSummary.fieldCount === 0) {
            list.append({
                cardOptions: {
                    imgSrc: 'public/app/plugins/panel/table/img/icn-table-panel.svg',
                },
            });
        }
        else {
            list.append({});
        }
    }
}
//# sourceMappingURL=suggestions.js.map