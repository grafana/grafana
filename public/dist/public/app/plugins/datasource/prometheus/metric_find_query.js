import { chain, map as _map, uniq } from 'lodash';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
var PrometheusMetricFindQuery = /** @class */ (function () {
    function PrometheusMetricFindQuery(datasource, query) {
        this.datasource = datasource;
        this.query = query;
        this.datasource = datasource;
        this.query = query;
        this.range = getTimeSrv().timeRange();
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
                return this.labelValuesQuery(labelValuesQuery[2]);
            }
        }
        var metricNamesQuery = this.query.match(metricNamesRegex);
        if (metricNamesQuery) {
            return this.metricNameQuery(metricNamesQuery[1]);
        }
        var queryResultQuery = this.query.match(queryResultRegex);
        if (queryResultQuery) {
            return lastValueFrom(this.queryResultQuery(queryResultQuery[1]));
        }
        // if query contains full metric name, return metric name and label list
        return this.metricNameAndLabelsQuery(this.query);
    };
    PrometheusMetricFindQuery.prototype.labelNamesQuery = function () {
        var start = this.datasource.getPrometheusTime(this.range.from, false);
        var end = this.datasource.getPrometheusTime(this.range.to, true);
        var params = {
            start: start.toString(),
            end: end.toString(),
        };
        var url = "/api/v1/labels";
        return this.datasource.metadataRequest(url, params).then(function (result) {
            return _map(result.data.data, function (value) {
                return { text: value };
            });
        });
    };
    PrometheusMetricFindQuery.prototype.labelValuesQuery = function (label, metric) {
        var start = this.datasource.getPrometheusTime(this.range.from, false);
        var end = this.datasource.getPrometheusTime(this.range.to, true);
        var url;
        if (!metric) {
            var params = {
                start: start.toString(),
                end: end.toString(),
            };
            // return label values globally
            url = "/api/v1/label/" + label + "/values";
            return this.datasource.metadataRequest(url, params).then(function (result) {
                return _map(result.data.data, function (value) {
                    return { text: value };
                });
            });
        }
        else {
            var params = {
                'match[]': metric,
                start: start.toString(),
                end: end.toString(),
            };
            url = "/api/v1/series";
            return this.datasource.metadataRequest(url, params).then(function (result) {
                var _labels = _map(result.data.data, function (metric) {
                    return metric[label] || '';
                }).filter(function (label) {
                    return label !== '';
                });
                return uniq(_labels).map(function (metric) {
                    return {
                        text: metric,
                        expandable: true,
                    };
                });
            });
        }
    };
    PrometheusMetricFindQuery.prototype.metricNameQuery = function (metricFilterPattern) {
        var start = this.datasource.getPrometheusTime(this.range.from, false);
        var end = this.datasource.getPrometheusTime(this.range.to, true);
        var params = {
            start: start.toString(),
            end: end.toString(),
        };
        var url = "/api/v1/label/__name__/values";
        return this.datasource.metadataRequest(url, params).then(function (result) {
            return chain(result.data.data)
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
        var instantQuery = { expr: query };
        return this.datasource.performInstantQuery(instantQuery, end).pipe(map(function (result) {
            return _map(result.data.data.result, function (metricData) {
                var text = metricData.metric.__name__ || '';
                delete metricData.metric.__name__;
                text +=
                    '{' +
                        _map(metricData.metric, function (v, k) {
                            return k + '="' + v + '"';
                        }).join(',') +
                        '}';
                text += ' ' + metricData.value[1] + ' ' + metricData.value[0] * 1000;
                return {
                    text: text,
                    expandable: true,
                };
            });
        }));
    };
    PrometheusMetricFindQuery.prototype.metricNameAndLabelsQuery = function (query) {
        var start = this.datasource.getPrometheusTime(this.range.from, false);
        var end = this.datasource.getPrometheusTime(this.range.to, true);
        var params = {
            'match[]': query,
            start: start.toString(),
            end: end.toString(),
        };
        var url = "/api/v1/series";
        var self = this;
        return this.datasource.metadataRequest(url, params).then(function (result) {
            return _map(result.data.data, function (metric) {
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