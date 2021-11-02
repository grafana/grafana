import { __assign, __awaiter, __generator } from "tslib";
import { variableAdapters } from '../adapters';
import { customBuilder } from '../shared/testing/builders';
import { initialState } from '../../dashboard/state/reducers';
import { templateVarsChangedInUrl } from './actions';
import { createCustomVariableAdapter } from '../custom/adapter';
variableAdapters.setInit(function () { return [createCustomVariableAdapter()]; });
function getTestContext(urlQueryMap) {
    if (urlQueryMap === void 0) { urlQueryMap = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var custom, setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, dashboardModel, dashboard, variables, templating, state, getState, dispatch, thunk;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    jest.clearAllMocks();
                    custom = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('A', 'B', 'C').build();
                    setValueFromUrlMock = jest.fn();
                    variableAdapters.get('custom').setValueFromUrl = setValueFromUrlMock;
                    templateVariableValueUpdatedMock = jest.fn();
                    startRefreshMock = jest.fn();
                    dashboardModel = {
                        templateVariableValueUpdated: templateVariableValueUpdatedMock,
                        startRefresh: startRefreshMock,
                        templating: { list: [custom] },
                    };
                    dashboard = __assign(__assign({}, initialState), { getModel: function () { return dashboardModel; } });
                    variables = { custom: custom };
                    templating = { variables: variables };
                    state = {
                        dashboard: dashboard,
                        templating: templating,
                    };
                    getState = function () { return state; };
                    dispatch = jest.fn();
                    thunk = templateVarsChangedInUrl(urlQueryMap);
                    return [4 /*yield*/, thunk(dispatch, getState, undefined)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { setValueFromUrlMock: setValueFromUrlMock, templateVariableValueUpdatedMock: templateVariableValueUpdatedMock, startRefreshMock: startRefreshMock, custom: custom }];
            }
        });
    });
}
describe('templateVarsChangedInUrl', function () {
    describe('when called with no variables in url query map', function () {
        it('then no value should change and dashboard should not be refreshed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        _a = _b.sent(), setValueFromUrlMock = _a.setValueFromUrlMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock;
                        expect(setValueFromUrlMock).not.toHaveBeenCalled();
                        expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
                        expect(startRefreshMock).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with no variables in url query map matching variables in state', function () {
        it('then no value should change and dashboard should not be refreshed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getTestContext({
                            'var-query': { value: 'A' },
                        })];
                    case 1:
                        _a = _b.sent(), setValueFromUrlMock = _a.setValueFromUrlMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock;
                        expect(setValueFromUrlMock).not.toHaveBeenCalled();
                        expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
                        expect(startRefreshMock).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with variables in url query map matching variables in state', function () {
        describe('and the values in url query map are the same as current in state', function () {
            it('then no value should change and dashboard should not be refreshed', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getTestContext({
                                'var-custom': { value: ['A', 'C'] },
                            })];
                        case 1:
                            _a = _b.sent(), setValueFromUrlMock = _a.setValueFromUrlMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock;
                            expect(setValueFromUrlMock).not.toHaveBeenCalled();
                            expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
                            expect(startRefreshMock).not.toHaveBeenCalled();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and the values in url query map are the not the same as current in state', function () {
            it('then the value should change to the value in url query map and dashboard should be refreshed', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, custom;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getTestContext({
                                'var-custom': { value: 'B' },
                            })];
                        case 1:
                            _a = _b.sent(), setValueFromUrlMock = _a.setValueFromUrlMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock, custom = _a.custom;
                            expect(setValueFromUrlMock).toHaveBeenCalledTimes(1);
                            expect(setValueFromUrlMock).toHaveBeenCalledWith(custom, 'B');
                            expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
                            expect(startRefreshMock).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            describe('but the values in url query map were removed', function () {
                it('then the value should change to the value in dashboard json and dashboard should be refreshed', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, custom;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, getTestContext({
                                    'var-custom': { value: '', removed: true },
                                })];
                            case 1:
                                _a = _b.sent(), setValueFromUrlMock = _a.setValueFromUrlMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock, custom = _a.custom;
                                expect(setValueFromUrlMock).toHaveBeenCalledTimes(1);
                                expect(setValueFromUrlMock).toHaveBeenCalledWith(custom, ['A', 'C']);
                                expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
                                expect(startRefreshMock).toHaveBeenCalledTimes(1);
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
        });
    });
});
//# sourceMappingURL=templateVarsChangedInUrl.test.js.map