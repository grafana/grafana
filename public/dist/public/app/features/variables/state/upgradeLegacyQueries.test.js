import { __awaiter, __generator } from "tslib";
import { customBuilder, queryBuilder } from '../shared/testing/builders';
import { VariableSupportType } from '@grafana/data';
import { toVariableIdentifier } from './types';
import { upgradeLegacyQueries } from './actions';
import { changeVariableProp } from './sharedReducer';
import { thunkTester } from '../../../../test/core/thunk/thunkTester';
function getTestContext(_a) {
    var _b;
    var _c = _a === void 0 ? {} : _a, _d = _c.query, query = _d === void 0 ? '' : _d, variable = _c.variable, datasource = _c.datasource;
    variable =
        variable !== null && variable !== void 0 ? variable : queryBuilder().withId('query').withName('query').withQuery(query).withDatasource('test-data').build();
    var state = {
        templating: {
            variables: (_b = {},
                _b[variable.id] = variable,
                _b),
        },
    };
    datasource = datasource !== null && datasource !== void 0 ? datasource : {
        name: 'TestData',
        metricFindQuery: function () { return undefined; },
        variables: { getType: function () { return VariableSupportType.Standard; }, toDataQuery: function () { return undefined; } },
    };
    var get = jest.fn().mockResolvedValue(datasource);
    var getDatasourceSrv = jest.fn().mockReturnValue({ get: get });
    var identifier = toVariableIdentifier(variable);
    return { state: state, get: get, getDatasourceSrv: getDatasourceSrv, identifier: identifier };
}
describe('upgradeLegacyQueries', function () {
    describe('when called with a query variable for a standard variable supported data source that has not been upgraded', function () {
        it('then it should dispatch changeVariableProp', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, state, identifier, get, getDatasourceSrv, dispatchedActions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({ query: '*' }), state = _a.state, identifier = _a.identifier, get = _a.get, getDatasourceSrv = _a.getDatasourceSrv;
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(upgradeLegacyQueries)
                                .whenThunkIsDispatched(identifier, getDatasourceSrv)];
                    case 1:
                        dispatchedActions = _b.sent();
                        expect(dispatchedActions).toEqual([
                            changeVariableProp({
                                type: 'query',
                                id: 'query',
                                data: {
                                    propName: 'query',
                                    propValue: {
                                        refId: 'TestData-query-Variable-Query',
                                        query: '*',
                                    },
                                },
                            }),
                        ]);
                        expect(get).toHaveBeenCalledTimes(1);
                        expect(get).toHaveBeenCalledWith('test-data');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a query variable for a standard variable supported data source that has been upgraded', function () {
        it('then it should not dispatch any actions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, state, identifier, get, getDatasourceSrv, dispatchedActions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({ query: { refId: 'A' } }), state = _a.state, identifier = _a.identifier, get = _a.get, getDatasourceSrv = _a.getDatasourceSrv;
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(upgradeLegacyQueries)
                                .whenThunkIsDispatched(identifier, getDatasourceSrv)];
                    case 1:
                        dispatchedActions = _b.sent();
                        expect(dispatchedActions).toEqual([]);
                        expect(get).toHaveBeenCalledTimes(1);
                        expect(get).toHaveBeenCalledWith('test-data');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a query variable for a legacy variable supported data source', function () {
        it('then it should not dispatch any actions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, _a, state, identifier, get, getDatasourceSrv, dispatchedActions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        datasource = {
                            name: 'TestData',
                            metricFindQuery: function () { return undefined; },
                        };
                        _a = getTestContext({ datasource: datasource }), state = _a.state, identifier = _a.identifier, get = _a.get, getDatasourceSrv = _a.getDatasourceSrv;
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(upgradeLegacyQueries)
                                .whenThunkIsDispatched(identifier, getDatasourceSrv)];
                    case 1:
                        dispatchedActions = _b.sent();
                        expect(dispatchedActions).toEqual([]);
                        expect(get).toHaveBeenCalledTimes(1);
                        expect(get).toHaveBeenCalledWith('test-data');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a query variable for a custom variable supported data source', function () {
        it('then it should not dispatch any actions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, _a, state, identifier, get, getDatasourceSrv, dispatchedActions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        datasource = {
                            name: 'TestData',
                            metricFindQuery: function () { return undefined; },
                            variables: { getType: function () { return VariableSupportType.Custom; }, query: function () { return undefined; }, editor: {} },
                        };
                        _a = getTestContext({ datasource: datasource }), state = _a.state, identifier = _a.identifier, get = _a.get, getDatasourceSrv = _a.getDatasourceSrv;
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(upgradeLegacyQueries)
                                .whenThunkIsDispatched(identifier, getDatasourceSrv)];
                    case 1:
                        dispatchedActions = _b.sent();
                        expect(dispatchedActions).toEqual([]);
                        expect(get).toHaveBeenCalledTimes(1);
                        expect(get).toHaveBeenCalledWith('test-data');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a query variable for a datasource variable supported data source', function () {
        it('then it should not dispatch any actions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, _a, state, identifier, get, getDatasourceSrv, dispatchedActions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        datasource = {
                            name: 'TestData',
                            metricFindQuery: function () { return undefined; },
                            variables: { getType: function () { return VariableSupportType.Datasource; } },
                        };
                        _a = getTestContext({ datasource: datasource }), state = _a.state, identifier = _a.identifier, get = _a.get, getDatasourceSrv = _a.getDatasourceSrv;
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(upgradeLegacyQueries)
                                .whenThunkIsDispatched(identifier, getDatasourceSrv)];
                    case 1:
                        dispatchedActions = _b.sent();
                        expect(dispatchedActions).toEqual([]);
                        expect(get).toHaveBeenCalledTimes(1);
                        expect(get).toHaveBeenCalledWith('test-data');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a custom variable', function () {
        it('then it should not dispatch any actions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, _a, state, identifier, get, getDatasourceSrv, dispatchedActions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        variable = customBuilder().withId('custom').withName('custom').build();
                        _a = getTestContext({ variable: variable }), state = _a.state, identifier = _a.identifier, get = _a.get, getDatasourceSrv = _a.getDatasourceSrv;
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(upgradeLegacyQueries)
                                .whenThunkIsDispatched(identifier, getDatasourceSrv)];
                    case 1:
                        dispatchedActions = _b.sent();
                        expect(dispatchedActions).toEqual([]);
                        expect(get).toHaveBeenCalledTimes(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=upgradeLegacyQueries.test.js.map