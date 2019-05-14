import * as tslib_1 from "tslib";
import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import InfluxSeries from './influx_series';
import InfluxQuery from './influx_query';
import ResponseParser from './response_parser';
import { InfluxQueryBuilder } from './query_builder';
var InfluxDatasource = /** @class */ (function () {
    /** @ngInject */
    function InfluxDatasource(instanceSettings, $q, backendSrv, templateSrv) {
        this.$q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.type = 'influxdb';
        this.urls = _.map(instanceSettings.url.split(','), function (url) {
            return url.trim();
        });
        this.username = instanceSettings.username;
        this.password = instanceSettings.password;
        this.name = instanceSettings.name;
        this.database = instanceSettings.database;
        this.basicAuth = instanceSettings.basicAuth;
        this.withCredentials = instanceSettings.withCredentials;
        this.interval = (instanceSettings.jsonData || {}).timeInterval;
        this.responseParser = new ResponseParser();
    }
    InfluxDatasource.prototype.query = function (options) {
        var _this = this;
        var timeFilter = this.getTimeFilter(options);
        var scopedVars = options.scopedVars;
        var targets = _.cloneDeep(options.targets);
        var queryTargets = [];
        var queryModel;
        var i, y;
        var allQueries = _.map(targets, function (target) {
            if (target.hide) {
                return '';
            }
            queryTargets.push(target);
            // backward compatibility
            scopedVars.interval = scopedVars.__interval;
            queryModel = new InfluxQuery(target, _this.templateSrv, scopedVars);
            return queryModel.render(true);
        }).reduce(function (acc, current) {
            if (current !== '') {
                acc += ';' + current;
            }
            return acc;
        });
        if (allQueries === '') {
            return this.$q.when({ data: [] });
        }
        // add global adhoc filters to timeFilter
        var adhocFilters = this.templateSrv.getAdhocFilters(this.name);
        if (adhocFilters.length > 0) {
            timeFilter += ' AND ' + queryModel.renderAdhocFilters(adhocFilters);
        }
        // replace grafana variables
        scopedVars.timeFilter = { value: timeFilter };
        // replace templated variables
        allQueries = this.templateSrv.replace(allQueries, scopedVars);
        return this._seriesQuery(allQueries, options).then(function (data) {
            if (!data || !data.results) {
                return [];
            }
            var seriesList = [];
            for (i = 0; i < data.results.length; i++) {
                var result = data.results[i];
                if (!result || !result.series) {
                    continue;
                }
                var target = queryTargets[i];
                var alias = target.alias;
                if (alias) {
                    alias = _this.templateSrv.replace(target.alias, options.scopedVars);
                }
                var influxSeries = new InfluxSeries({
                    series: data.results[i].series,
                    alias: alias,
                });
                switch (target.resultFormat) {
                    case 'table': {
                        seriesList.push(influxSeries.getTable());
                        break;
                    }
                    default: {
                        var timeSeries = influxSeries.getTimeSeries();
                        for (y = 0; y < timeSeries.length; y++) {
                            seriesList.push(timeSeries[y]);
                        }
                        break;
                    }
                }
            }
            return { data: seriesList };
        });
    };
    InfluxDatasource.prototype.annotationQuery = function (options) {
        if (!options.annotation.query) {
            return this.$q.reject({
                message: 'Query missing in annotation definition',
            });
        }
        var timeFilter = this.getTimeFilter({ rangeRaw: options.rangeRaw, timezone: options.timezone });
        var query = options.annotation.query.replace('$timeFilter', timeFilter);
        query = this.templateSrv.replace(query, null, 'regex');
        return this._seriesQuery(query, options).then(function (data) {
            if (!data || !data.results || !data.results[0]) {
                throw { message: 'No results in response from InfluxDB' };
            }
            return new InfluxSeries({
                series: data.results[0].series,
                annotation: options.annotation,
            }).getAnnotations();
        });
    };
    InfluxDatasource.prototype.targetContainsTemplate = function (target) {
        var e_1, _a, e_2, _b;
        try {
            for (var _c = tslib_1.__values(target.groupBy), _d = _c.next(); !_d.done; _d = _c.next()) {
                var group = _d.value;
                try {
                    for (var _e = tslib_1.__values(group.params), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var param = _f.value;
                        if (this.templateSrv.variableExists(param)) {
                            return true;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        for (var i in target.tags) {
            if (this.templateSrv.variableExists(target.tags[i].value)) {
                return true;
            }
        }
        return false;
    };
    InfluxDatasource.prototype.metricFindQuery = function (query, options) {
        var interpolated = this.templateSrv.replace(query, null, 'regex');
        return this._seriesQuery(interpolated, options).then(_.curry(this.responseParser.parse)(query));
    };
    InfluxDatasource.prototype.getTagKeys = function (options) {
        var queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
        var query = queryBuilder.buildExploreQuery('TAG_KEYS');
        return this.metricFindQuery(query, options);
    };
    InfluxDatasource.prototype.getTagValues = function (options) {
        var queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
        var query = queryBuilder.buildExploreQuery('TAG_VALUES', options.key);
        return this.metricFindQuery(query, options);
    };
    InfluxDatasource.prototype._seriesQuery = function (query, options) {
        if (!query) {
            return this.$q.when({ results: [] });
        }
        if (options && options.range) {
            var timeFilter = this.getTimeFilter({ rangeRaw: options.range, timezone: options.timezone });
            query = query.replace('$timeFilter', timeFilter);
        }
        return this._influxRequest('GET', '/query', { q: query, epoch: 'ms' }, options);
    };
    InfluxDatasource.prototype.serializeParams = function (params) {
        if (!params) {
            return '';
        }
        return _.reduce(params, function (memo, value, key) {
            if (value === null || value === undefined) {
                return memo;
            }
            memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            return memo;
        }, []).join('&');
    };
    InfluxDatasource.prototype.testDatasource = function () {
        var queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
        var query = queryBuilder.buildExploreQuery('RETENTION POLICIES');
        return this._seriesQuery(query)
            .then(function (res) {
            var error = _.get(res, 'results[0].error');
            if (error) {
                return { status: 'error', message: error };
            }
            return { status: 'success', message: 'Data source is working' };
        })
            .catch(function (err) {
            return { status: 'error', message: err.message };
        });
    };
    InfluxDatasource.prototype._influxRequest = function (method, url, data, options) {
        var currentUrl = this.urls.shift();
        this.urls.push(currentUrl);
        var params = {};
        if (this.username) {
            params.u = this.username;
            params.p = this.password;
        }
        if (options && options.database) {
            params.db = options.database;
        }
        else if (this.database) {
            params.db = this.database;
        }
        if (method === 'GET') {
            _.extend(params, data);
            data = null;
        }
        var req = {
            method: method,
            url: currentUrl + url,
            params: params,
            data: data,
            precision: 'ms',
            inspect: { type: 'influxdb' },
            paramSerializer: this.serializeParams,
        };
        req.headers = req.headers || {};
        if (this.basicAuth || this.withCredentials) {
            req.withCredentials = true;
        }
        if (this.basicAuth) {
            req.headers.Authorization = this.basicAuth;
        }
        return this.backendSrv.datasourceRequest(req).then(function (result) {
            return result.data;
        }, function (err) {
            if (err.status !== 0 || err.status >= 300) {
                if (err.data && err.data.error) {
                    throw {
                        message: 'InfluxDB Error: ' + err.data.error,
                        data: err.data,
                        config: err.config,
                    };
                }
                else {
                    throw {
                        message: 'Network Error: ' + err.statusText + '(' + err.status + ')',
                        data: err.data,
                        config: err.config,
                    };
                }
            }
        });
    };
    InfluxDatasource.prototype.getTimeFilter = function (options) {
        var from = this.getInfluxTime(options.rangeRaw.from, false, options.timezone);
        var until = this.getInfluxTime(options.rangeRaw.to, true, options.timezone);
        var fromIsAbsolute = from[from.length - 1] === 'ms';
        if (until === 'now()' && !fromIsAbsolute) {
            return 'time >= ' + from;
        }
        return 'time >= ' + from + ' and time <= ' + until;
    };
    InfluxDatasource.prototype.getInfluxTime = function (date, roundUp, timezone) {
        if (_.isString(date)) {
            if (date === 'now') {
                return 'now()';
            }
            var parts = /^now-(\d+)([dhms])$/.exec(date);
            if (parts) {
                var amount = parseInt(parts[1], 10);
                var unit = parts[2];
                return 'now() - ' + amount + unit;
            }
            date = dateMath.parse(date, roundUp, timezone);
        }
        return date.valueOf() + 'ms';
    };
    return InfluxDatasource;
}());
export default InfluxDatasource;
//# sourceMappingURL=datasource.js.map