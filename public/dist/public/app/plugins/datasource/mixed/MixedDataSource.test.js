import { __assign, __awaiter, __generator } from "tslib";
import { LoadingState } from '@grafana/data';
import { lastValueFrom } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DatasourceSrvMock, MockObservableDataSourceApi } from 'test/mocks/datasource_srv';
import { MixedDatasource } from './module';
var defaultDS = new MockObservableDataSourceApi('DefaultDS', [{ data: ['DDD'] }]);
var datasourceSrv = new DatasourceSrvMock(defaultDS, {
    '-- Mixed --': new MockObservableDataSourceApi('mixed'),
    A: new MockObservableDataSourceApi('DSA', [{ data: ['AAAA'] }]),
    B: new MockObservableDataSourceApi('DSB', [{ data: ['BBBB'] }]),
    C: new MockObservableDataSourceApi('DSC', [{ data: ['CCCC'] }]),
    D: new MockObservableDataSourceApi('DSD', [{ data: [] }], {}, 'syntax error near FROM'),
    E: new MockObservableDataSourceApi('DSE', [{ data: [] }], {}, 'syntax error near WHERE'),
    Loki: new MockObservableDataSourceApi('Loki', [
        { data: ['A'], key: 'A' },
        { data: ['B'], key: 'B' },
    ]),
});
var getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getDataSourceSrv: function () { return getDataSourceSrvMock(); } })); });
describe('MixedDatasource', function () {
    describe('with no errors', function () {
        it('direct query should return results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, requestMixed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = new MixedDatasource({});
                        requestMixed = getQueryOptions({
                            targets: [
                                { refId: 'QA', datasource: { uid: 'A' } },
                                { refId: 'QB', datasource: { uid: 'B' } },
                                { refId: 'QC', datasource: { uid: 'C' } }, // 3
                            ],
                        });
                        return [4 /*yield*/, expect(ds.query(requestMixed)).toEmitValuesWith(function (results) {
                                expect(results.length).toBe(3);
                                expect(results[0].data).toEqual(['AAAA']);
                                expect(results[0].state).toEqual(LoadingState.Loading);
                                expect(results[1].data).toEqual(['BBBB']);
                                expect(results[2].data).toEqual(['CCCC']);
                                expect(results[2].state).toEqual(LoadingState.Done);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('with errors', function () {
        it('direct query should return results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, requestMixed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = new MixedDatasource({});
                        requestMixed = getQueryOptions({
                            targets: [
                                { refId: 'QA', datasource: { uid: 'A' } },
                                { refId: 'QD', datasource: { uid: 'D' } },
                                { refId: 'QB', datasource: { uid: 'B' } },
                                { refId: 'QE', datasource: { uid: 'E' } },
                                { refId: 'QC', datasource: { uid: 'C' } }, // 5
                            ],
                        });
                        return [4 /*yield*/, expect(ds.query(requestMixed)).toEmitValuesWith(function (results) {
                                expect(results[0].data).toEqual(['AAAA']);
                                expect(results[0].state).toEqual(LoadingState.Loading);
                                expect(results[1].data).toEqual([]);
                                expect(results[1].state).toEqual(LoadingState.Error);
                                expect(results[1].error).toEqual({ message: 'DSD: syntax error near FROM' });
                                expect(results[2].data).toEqual(['BBBB']);
                                expect(results[2].state).toEqual(LoadingState.Loading);
                                expect(results[3].data).toEqual([]);
                                expect(results[3].state).toEqual(LoadingState.Error);
                                expect(results[3].error).toEqual({ message: 'DSE: syntax error near WHERE' });
                                expect(results[4].data).toEqual(['CCCC']);
                                expect(results[4].state).toEqual(LoadingState.Loading);
                                expect(results[5].data).toEqual([]);
                                expect(results[5].state).toEqual(LoadingState.Error);
                                expect(results[5].error).toEqual({ message: 'DSD: syntax error near FROM' });
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    it('should return both query results from the same data source', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, request;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ds = new MixedDatasource({});
                    request = {
                        targets: [
                            { refId: 'A', datasource: { uid: 'Loki' } },
                            { refId: 'B', datasource: { uid: 'Loki' } },
                            { refId: 'C', datasource: { uid: 'A' } },
                        ],
                    };
                    return [4 /*yield*/, expect(ds.query(request)).toEmitValuesWith(function (results) {
                            expect(results).toHaveLength(3);
                            expect(results[0].key).toBe('mixed-0-A');
                            expect(results[1].key).toBe('mixed-0-B');
                            expect(results[1].state).toBe(LoadingState.Loading);
                            expect(results[2].key).toBe('mixed-1-');
                            expect(results[2].state).toBe(LoadingState.Done);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should not return the error for the second time', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, request;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ds = new MixedDatasource({});
                    request = {
                        targets: [
                            { refId: 'A', datasource: 'Loki' },
                            { refId: 'DD', datasource: 'D' },
                            { refId: 'C', datasource: 'A' },
                        ],
                    };
                    return [4 /*yield*/, lastValueFrom(ds.query(request))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(ds.query({
                            targets: [
                                { refId: 'QA', datasource: { uid: 'A' } },
                                { refId: 'QB', datasource: { uid: 'B' } },
                            ],
                        })).toEmitValuesWith(function (results) {
                            expect(results).toHaveLength(2);
                            expect(results[0].key).toBe('mixed-0-');
                            expect(results[1].key).toBe('mixed-1-');
                            expect(results[1].state).toBe(LoadingState.Done);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=MixedDataSource.test.js.map