import * as tslib_1 from "tslib";
import _ from 'lodash';
var GrafanaDatasource = /** @class */ (function () {
    /** @ngInject */
    function GrafanaDatasource(backendSrv, $q, templateSrv) {
        this.backendSrv = backendSrv;
        this.$q = $q;
        this.templateSrv = templateSrv;
    }
    GrafanaDatasource.prototype.query = function (options) {
        return this.backendSrv
            .get('/api/tsdb/testdata/random-walk', {
            from: options.range.from.valueOf(),
            to: options.range.to.valueOf(),
            intervalMs: options.intervalMs,
            maxDataPoints: options.maxDataPoints,
        })
            .then(function (res) {
            var data = [];
            if (res.results) {
                _.forEach(res.results, function (queryRes) {
                    var e_1, _a;
                    try {
                        for (var _b = tslib_1.__values(queryRes.series), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var series = _c.value;
                            data.push({
                                target: series.name,
                                datapoints: series.points,
                            });
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                });
            }
            return { data: data };
        });
    };
    GrafanaDatasource.prototype.metricFindQuery = function (options) {
        return this.$q.when({ data: [] });
    };
    GrafanaDatasource.prototype.annotationQuery = function (options) {
        var e_2, _a, e_3, _b;
        var params = {
            from: options.range.from.valueOf(),
            to: options.range.to.valueOf(),
            limit: options.annotation.limit,
            tags: options.annotation.tags,
            matchAny: options.annotation.matchAny,
        };
        if (options.annotation.type === 'dashboard') {
            // if no dashboard id yet return
            if (!options.dashboard.id) {
                return this.$q.when([]);
            }
            // filter by dashboard id
            params.dashboardId = options.dashboard.id;
            // remove tags filter if any
            delete params.tags;
        }
        else {
            // require at least one tag
            if (!_.isArray(options.annotation.tags) || options.annotation.tags.length === 0) {
                return this.$q.when([]);
            }
            var delimiter_1 = '__delimiter__';
            var tags = [];
            try {
                for (var _c = tslib_1.__values(params.tags), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var t = _d.value;
                    var renderedValues = this.templateSrv.replace(t, {}, function (value) {
                        if (typeof value === 'string') {
                            return value;
                        }
                        return value.join(delimiter_1);
                    });
                    try {
                        for (var _e = tslib_1.__values(renderedValues.split(delimiter_1)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var tt = _f.value;
                            tags.push(tt);
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
            params.tags = tags;
        }
        return this.backendSrv.get('/api/annotations', params);
    };
    return GrafanaDatasource;
}());
export { GrafanaDatasource };
//# sourceMappingURL=datasource.js.map