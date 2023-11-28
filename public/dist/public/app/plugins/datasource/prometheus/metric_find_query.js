import { chain, map as _map, uniq } from 'lodash';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getPrometheusTime } from './language_utils';
import { PrometheusLabelNamesRegex, PrometheusLabelNamesRegexWithMatch, PrometheusMetricNamesRegex, PrometheusQueryResultRegex, } from './migrations/variableMigration';
export default class PrometheusMetricFindQuery {
    constructor(datasource, query) {
        this.datasource = datasource;
        this.query = query;
        this.datasource = datasource;
        this.query = query;
        this.range = getTimeSrv().timeRange();
    }
    process() {
        const labelNamesRegex = PrometheusLabelNamesRegex;
        const labelNamesRegexWithMatch = PrometheusLabelNamesRegexWithMatch;
        const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;
        const metricNamesRegex = PrometheusMetricNamesRegex;
        const queryResultRegex = PrometheusQueryResultRegex;
        const labelNamesQuery = this.query.match(labelNamesRegex);
        const labelNamesMatchQuery = this.query.match(labelNamesRegexWithMatch);
        if (labelNamesMatchQuery) {
            const selector = `{__name__=~".*${labelNamesMatchQuery[1]}.*"}`;
            return this.datasource.languageProvider.getSeriesLabels(selector, []).then((results) => results.map((result) => ({
                text: result,
            })));
        }
        if (labelNamesQuery) {
            return this.datasource.getTagKeys({ filters: [] });
        }
        const labelValuesQuery = this.query.match(labelValuesRegex);
        if (labelValuesQuery) {
            if (labelValuesQuery[1]) {
                return this.labelValuesQuery(labelValuesQuery[2], labelValuesQuery[1]);
            }
            else {
                return this.labelValuesQuery(labelValuesQuery[2]);
            }
        }
        const metricNamesQuery = this.query.match(metricNamesRegex);
        if (metricNamesQuery) {
            return this.metricNameQuery(metricNamesQuery[1]);
        }
        const queryResultQuery = this.query.match(queryResultRegex);
        if (queryResultQuery) {
            return lastValueFrom(this.queryResultQuery(queryResultQuery[1]));
        }
        // if query contains full metric name, return metric name and label list
        const expressions = ['label_values()', 'metrics()', 'query_result()'];
        if (!expressions.includes(this.query)) {
            return this.metricNameAndLabelsQuery(this.query);
        }
        return Promise.resolve([]);
    }
    labelValuesQuery(label, metric) {
        const start = getPrometheusTime(this.range.from, false);
        const end = getPrometheusTime(this.range.to, true);
        const params = Object.assign(Object.assign({}, (metric && { 'match[]': metric })), { start: start.toString(), end: end.toString() });
        if (!metric || this.datasource.hasLabelsMatchAPISupport()) {
            const url = `/api/v1/label/${label}/values`;
            return this.datasource.metadataRequest(url, params).then((result) => {
                return _map(result.data.data, (value) => {
                    return { text: value };
                });
            });
        }
        else {
            const url = `/api/v1/series`;
            return this.datasource.metadataRequest(url, params).then((result) => {
                const _labels = _map(result.data.data, (metric) => {
                    return metric[label] || '';
                }).filter((label) => {
                    return label !== '';
                });
                return uniq(_labels).map((metric) => {
                    return {
                        text: metric,
                        expandable: true,
                    };
                });
            });
        }
    }
    metricNameQuery(metricFilterPattern) {
        const start = getPrometheusTime(this.range.from, false);
        const end = getPrometheusTime(this.range.to, true);
        const params = {
            start: start.toString(),
            end: end.toString(),
        };
        const url = `/api/v1/label/__name__/values`;
        return this.datasource.metadataRequest(url, params).then((result) => {
            return chain(result.data.data)
                .filter((metricName) => {
                const r = new RegExp(metricFilterPattern);
                return r.test(metricName);
            })
                .map((matchedMetricName) => {
                return {
                    text: matchedMetricName,
                    expandable: true,
                };
            })
                .value();
        });
    }
    queryResultQuery(query) {
        const end = getPrometheusTime(this.range.to, true);
        const instantQuery = { expr: query };
        return this.datasource.performInstantQuery(instantQuery, end).pipe(map((result) => {
            switch (result.data.data.resultType) {
                case 'scalar': // [ <unix_time>, "<scalar_value>" ]
                case 'string': // [ <unix_time>, "<string_value>" ]
                    return [
                        {
                            text: result.data.data.result[1] || '',
                            expandable: false,
                        },
                    ];
                case 'vector':
                    return _map(result.data.data.result, (metricData) => {
                        let text = metricData.metric.__name__ || '';
                        delete metricData.metric.__name__;
                        text +=
                            '{' +
                                _map(metricData.metric, (v, k) => {
                                    return k + '="' + v + '"';
                                }).join(',') +
                                '}';
                        text += ' ' + metricData.value[1] + ' ' + metricData.value[0] * 1000;
                        return {
                            text: text,
                            expandable: true,
                        };
                    });
                default:
                    throw Error(`Unknown/Unhandled result type: [${result.data.data.resultType}]`);
            }
        }));
    }
    metricNameAndLabelsQuery(query) {
        const start = getPrometheusTime(this.range.from, false);
        const end = getPrometheusTime(this.range.to, true);
        const params = {
            'match[]': query,
            start: start.toString(),
            end: end.toString(),
        };
        const url = `/api/v1/series`;
        const self = this;
        return this.datasource.metadataRequest(url, params).then((result) => {
            return _map(result.data.data, (metric) => {
                return {
                    text: self.datasource.getOriginalMetricName(metric),
                    expandable: true,
                };
            });
        });
    }
}
//# sourceMappingURL=metric_find_query.js.map