import { AbstractLabelOperator, LanguageProvider } from '@grafana/data';
export default class ElasticsearchLanguageProvider extends LanguageProvider {
    constructor(datasource, initialValues) {
        super();
        this.datasource = datasource;
        Object.assign(this, initialValues);
    }
    /**
     * Queries are transformed to an ES Logs query since it's the behaviour most users expect.
     **/
    importFromAbstractQuery(abstractQuery) {
        return {
            metrics: [
                {
                    id: '1',
                    type: 'logs',
                },
            ],
            query: this.getElasticsearchQuery(abstractQuery.labelMatchers),
            refId: abstractQuery.refId,
        };
    }
    getElasticsearchQuery(labels) {
        return labels
            .map((label) => {
            switch (label.operator) {
                case AbstractLabelOperator.Equal: {
                    return label.name + ':"' + label.value + '"';
                }
                case AbstractLabelOperator.NotEqual: {
                    return '-' + label.name + ':"' + label.value + '"';
                }
                case AbstractLabelOperator.EqualRegEx: {
                    return label.name + ':/' + label.value + '/';
                }
                case AbstractLabelOperator.NotEqualRegEx: {
                    return '-' + label.name + ':/' + label.value + '/';
                }
            }
        })
            .join(' AND ');
    }
}
//# sourceMappingURL=LanguageProvider.js.map