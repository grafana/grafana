import { __extends, __values } from "tslib";
import { LanguageProvider } from '@grafana/data';
import Prism, { Token } from 'prismjs';
import grammar from '../prometheus/promql';
function getNameLabelValue(promQuery, tokens) {
    var nameLabelValue = '';
    for (var prop in tokens) {
        if (typeof tokens[prop] === 'string') {
            nameLabelValue = tokens[prop];
            break;
        }
    }
    return nameLabelValue;
}
function extractPrometheusLabels(promQuery) {
    var labels = [];
    if (!promQuery || promQuery.length === 0) {
        return labels;
    }
    var tokens = Prism.tokenize(promQuery, grammar);
    var nameLabelValue = getNameLabelValue(promQuery, tokens);
    if (nameLabelValue && nameLabelValue.length > 0) {
        labels.push(['__name__', '=', '"' + nameLabelValue + '"']);
    }
    for (var prop in tokens) {
        if (tokens[prop] instanceof Token) {
            var token = tokens[prop];
            if (token.type === 'context-labels') {
                var labelKey = '';
                var labelValue = '';
                var labelOperator = '';
                var contentTokens = token.content;
                for (var currentToken in contentTokens) {
                    if (typeof contentTokens[currentToken] === 'string') {
                        var currentStr = void 0;
                        currentStr = contentTokens[currentToken];
                        if (currentStr === '=' || currentStr === '!=' || currentStr === '=~' || currentStr === '!~') {
                            labelOperator = currentStr;
                        }
                    }
                    else if (contentTokens[currentToken] instanceof Token) {
                        switch (contentTokens[currentToken].type) {
                            case 'label-key':
                                labelKey = contentTokens[currentToken].content;
                                break;
                            case 'label-value':
                                labelValue = contentTokens[currentToken].content;
                                labels.push([labelKey, labelOperator, labelValue]);
                                break;
                        }
                    }
                }
            }
        }
    }
    return labels;
}
function getElasticsearchQuery(prometheusLabels) {
    var e_1, _a;
    var elasticsearchLuceneLabels = [];
    try {
        for (var prometheusLabels_1 = __values(prometheusLabels), prometheusLabels_1_1 = prometheusLabels_1.next(); !prometheusLabels_1_1.done; prometheusLabels_1_1 = prometheusLabels_1.next()) {
            var keyOperatorValue = prometheusLabels_1_1.value;
            switch (keyOperatorValue[1]) {
                case '=': {
                    elasticsearchLuceneLabels.push(keyOperatorValue[0] + ':' + keyOperatorValue[2]);
                    break;
                }
                case '!=': {
                    elasticsearchLuceneLabels.push('NOT ' + keyOperatorValue[0] + ':' + keyOperatorValue[2]);
                    break;
                }
                case '=~': {
                    elasticsearchLuceneLabels.push(keyOperatorValue[0] + ':/' + keyOperatorValue[2].substring(1, keyOperatorValue[2].length - 1) + '/');
                    break;
                }
                case '!~': {
                    elasticsearchLuceneLabels.push('NOT ' + keyOperatorValue[0] + ':/' + keyOperatorValue[2].substring(1, keyOperatorValue[2].length - 1) + '/');
                    break;
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (prometheusLabels_1_1 && !prometheusLabels_1_1.done && (_a = prometheusLabels_1.return)) _a.call(prometheusLabels_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return elasticsearchLuceneLabels.join(' AND ');
}
var ElasticsearchLanguageProvider = /** @class */ (function (_super) {
    __extends(ElasticsearchLanguageProvider, _super);
    function ElasticsearchLanguageProvider(datasource, initialValues) {
        var _this = _super.call(this) || this;
        _this.datasource = datasource;
        Object.assign(_this, initialValues);
        return _this;
    }
    /**
     * The current implementation only supports switching from Prometheus/Loki queries.
     * For them we transform the query to an ES Logs query since it's the behaviour most users expect.
     * For every other datasource we just copy the refId and let the query editor initialize a default query.
     * */
    ElasticsearchLanguageProvider.prototype.importQueries = function (queries, datasourceType) {
        if (datasourceType === 'prometheus' || datasourceType === 'loki') {
            return queries.map(function (query) {
                var prometheusQuery = query;
                var expr = getElasticsearchQuery(extractPrometheusLabels(prometheusQuery.expr));
                return {
                    metrics: [
                        {
                            id: '1',
                            type: 'logs',
                        },
                    ],
                    query: expr,
                    refId: query.refId,
                };
            });
        }
        return queries.map(function (query) {
            return {
                refId: query.refId,
            };
        });
    };
    return ElasticsearchLanguageProvider;
}(LanguageProvider));
export default ElasticsearchLanguageProvider;
//# sourceMappingURL=language_provider.js.map