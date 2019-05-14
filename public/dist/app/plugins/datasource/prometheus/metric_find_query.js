import _ from 'lodash';
var PrometheusMetricFindQuery = /** @class */ (function () {
    function PrometheusMetricFindQuery(datasource, query, timeSrv) {
        this.datasource = datasource;
        this.query = query;
        this.range = timeSrv.timeRange();
    }
    PrometheusMetricFindQuery.prototype.process = function () {
        var labelNamesRegex = /^label_names\(\)\s*$/;
        var labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;
        var metricNamesRegex = /^metrics\((.+)\)\s*$/;
        var queryResultRegex = /^query_result\((.+)\)\s*$/;
        var labelNamesQuery = this.query.match(labelNamesRegex);
        if (labelNamesQuery) {
            return this.labelNamesQuery();
        }
        var labelValuesQuery = this.query.match(labelValuesRegex);
        if (labelValuesQuery) {
            if (labelValuesQuery[1]) {
                return this.labelValuesQuery(labelValuesQuery[2], labelValuesQuery[1]);
            }
            else {
                return this.labelValuesQuery(labelValuesQuery[2], null);
            }
        }
        var metricNamesQuery = this.query.match(metricNamesRegex);
        if (metricNamesQuery) {
            return this.metricNameQuery(metricNamesQuery[1]);
        }
        var queryResultQuery = this.query.match(queryResultRegex);
        if (queryResultQuery) {
            return this.queryResultQuery(queryResultQuery[1]);
        }
        // if query contains full metric name, return metric name and label list
        return this.metricNameAndLabelsQuery(this.query);
    };
    PrometheusMetricFindQuery.prototype.labelNamesQuery = function () {
        var url = '/api/v1/labels';
        return this.datasource.metadataRequest(url).then(function (result) {
            return _.map(result.data.data, function (value) {
                return { text: value };
            });
        });
    };
    PrometheusMetricFindQuery.prototype.labelValuesQuery = function (label, metric) {
        var url;
        if (!metric) {
            // return label values globally
            url = '/api/v1/label/' + label + '/values';
            return this.datasource.metadataRequest(url).then(function (result) {
                return _.map(result.data.data, function (value) {
                    return { text: value };
                });
            });
        }
        else {
            var start = this.datasource.getPrometheusTime(this.range.from, false);
            var end = this.datasource.getPrometheusTime(this.range.to, true);
            url = '/api/v1/series?match[]=' + encodeURIComponent(metric) + '&start=' + start + '&end=' + end;
            return this.datasource.metadataRequest(url).then(function (result) {
                var _labels = _.map(result.data.data, function (metric) {
                    return metric[label] || '';
                }).filter(function (label) {
                    return label !== '';
                });
                return _.uniq(_labels).map(function (metric) {
                    return {
                        text: metric,
                        expandable: true,
                    };
                });
            });
        }
    };
    PrometheusMetricFindQuery.prototype.metricNameQuery = function (metricFilterPattern) {
        var url = '/api/v1/label/__name__/values';
        return this.datasource.metadataRequest(url).then(function (result) {
            return _.chain(result.data.data)
                .filter(function (metricName) {
                var r = new RegExp(metricFilterPattern);
                return r.test(metricName);
            })
                .map(function (matchedMetricName) {
                return {
                    text: matchedMetricName,
                    expandable: true,
                };
            })
                .value();
        });
    };
    PrometheusMetricFindQuery.prototype.queryResultQuery = function (query) {
        var end = this.datasource.getPrometheusTime(this.range.to, true);
        return this.datasource.performInstantQuery({ expr: query }, end).then(function (result) {
            return _.map(result.data.data.result, function (metricData) {
                var text = metricData.metric.__name__ || '';
                delete metricData.metric.__name__;
                text +=
                    '{' +
                        _.map(metricData.metric, function (v, k) {
                            return k + '="' + v + '"';
                        }).join(',') +
                        '}';
                text += ' ' + metricData.value[1] + ' ' + metricData.value[0] * 1000;
                return {
                    text: text,
                    expandable: true,
                };
            });
        });
    };
    PrometheusMetricFindQuery.prototype.metricNameAndLabelsQuery = function (query) {
        var start = this.datasource.getPrometheusTime(this.range.from, false);
        var end = this.datasource.getPrometheusTime(this.range.to, true);
        var url = '/api/v1/series?match[]=' + encodeURIComponent(query) + '&start=' + start + '&end=' + end;
        var self = this;
        return this.datasource.metadataRequest(url).then(function (result) {
            return _.map(result.data.data, function (metric) {
                return {
                    text: self.datasource.getOriginalMetricName(metric),
                    expandable: true,
                };
            });
        });
    };
    return PrometheusMetricFindQuery;
}());
export default PrometheusMetricFindQuery;
//# sourceMappingURL=metric_find_query.js.map