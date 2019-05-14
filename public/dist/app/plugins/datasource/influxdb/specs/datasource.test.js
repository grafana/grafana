var _this = this;
import * as tslib_1 from "tslib";
import InfluxDatasource from '../datasource';
import $q from 'q';
import { TemplateSrvStub } from 'test/specs/helpers';
describe('InfluxDataSource', function () {
    var ctx = {
        backendSrv: {},
        $q: $q,
        templateSrv: new TemplateSrvStub(),
        instanceSettings: { url: 'url', name: 'influxDb', jsonData: {} },
    };
    beforeEach(function () {
        ctx.instanceSettings.url = '/api/datasources/proxy/1';
        ctx.ds = new InfluxDatasource(ctx.instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
    });
    describe('When issuing metricFindQuery', function () {
        var query = 'SELECT max(value) FROM measurement WHERE $timeFilter';
        var queryOptions = {
            range: {
                from: '2018-01-01T00:00:00Z',
                to: '2018-01-02T00:00:00Z',
            },
        };
        var requestQuery;
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.backendSrv.datasourceRequest = function (req) {
                            requestQuery = req.params.q;
                            return ctx.$q.when({
                                results: [
                                    {
                                        series: [
                                            {
                                                name: 'measurement',
                                                columns: ['max'],
                                                values: [[1]],
                                            },
                                        ],
                                    },
                                ],
                            });
                        };
                        return [4 /*yield*/, ctx.ds.metricFindQuery(query, queryOptions).then(function (_) { })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should replace $timefilter', function () {
            expect(requestQuery).toMatch('time >= 1514764800000ms and time <= 1514851200000ms');
        });
    });
});
//# sourceMappingURL=datasource.test.js.map