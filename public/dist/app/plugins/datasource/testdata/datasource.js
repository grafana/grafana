import * as tslib_1 from "tslib";
import _ from 'lodash';
import TableModel from 'app/core/table_model';
var TestDataDatasource = /** @class */ (function () {
    /** @ngInject */
    function TestDataDatasource(instanceSettings, backendSrv, $q) {
        this.backendSrv = backendSrv;
        this.$q = $q;
        this.id = instanceSettings.id;
    }
    TestDataDatasource.prototype.query = function (options) {
        var _this = this;
        var queries = _.filter(options.targets, function (item) {
            return item.hide !== true;
        }).map(function (item) {
            return {
                refId: item.refId,
                scenarioId: item.scenarioId,
                intervalMs: options.intervalMs,
                maxDataPoints: options.maxDataPoints,
                stringInput: item.stringInput,
                points: item.points,
                alias: item.alias,
                datasourceId: _this.id,
            };
        });
        if (queries.length === 0) {
            return this.$q.when({ data: [] });
        }
        return this.backendSrv
            .datasourceRequest({
            method: 'POST',
            url: '/api/tsdb/query',
            data: {
                from: options.range.from.valueOf().toString(),
                to: options.range.to.valueOf().toString(),
                queries: queries,
            },
        })
            .then(function (res) {
            var data = [];
            if (res.data.results) {
                _.forEach(res.data.results, function (queryRes) {
                    var e_1, _a, e_2, _b;
                    if (queryRes.tables) {
                        try {
                            for (var _c = tslib_1.__values(queryRes.tables), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var table = _d.value;
                                var model = new TableModel();
                                model.rows = table.rows;
                                model.columns = table.columns;
                                data.push(model);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    try {
                        for (var _e = tslib_1.__values(queryRes.series), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var series = _f.value;
                            data.push({
                                target: series.name,
                                datapoints: series.points,
                            });
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                });
            }
            return { data: data };
        });
    };
    TestDataDatasource.prototype.annotationQuery = function (options) {
        var timeWalker = options.range.from.valueOf();
        var to = options.range.to.valueOf();
        var events = [];
        var eventCount = 10;
        var step = (to - timeWalker) / eventCount;
        for (var i = 0; i < eventCount; i++) {
            events.push({
                annotation: options.annotation,
                time: timeWalker,
                text: 'This is the text, <a href="https://grafana.com">Grafana.com</a>',
                tags: ['text', 'server'],
            });
            timeWalker += step;
        }
        return this.$q.when(events);
    };
    TestDataDatasource.prototype.testDatasource = function () {
        return Promise.resolve({
            status: 'success',
            message: 'Data source is working',
        });
    };
    TestDataDatasource.prototype.getScenarios = function () {
        return this.backendSrv.get('/api/tsdb/testdata/scenarios');
    };
    return TestDataDatasource;
}());
export { TestDataDatasource };
//# sourceMappingURL=datasource.js.map