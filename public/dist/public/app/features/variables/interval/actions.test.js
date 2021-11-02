import { __awaiter, __generator } from "tslib";
import { getRootReducer } from '../state/helpers';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { updateAutoValue, updateIntervalVariableOptions } from './actions';
import { createIntervalOptions } from './reducer';
import { addVariable, setCurrentVariableValue, variableStateFailed, variableStateFetching, } from '../state/sharedReducer';
import { variableAdapters } from '../adapters';
import { createIntervalVariableAdapter } from './adapter';
import { dateTime } from '@grafana/data';
import { getTimeSrv, setTimeSrv } from '../../dashboard/services/TimeSrv';
import { intervalBuilder } from '../shared/testing/builders';
import { updateOptions } from '../state/actions';
import { notifyApp } from '../../../core/actions';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
describe('interval actions', function () {
    variableAdapters.setInit(function () { return [createIntervalVariableAdapter()]; });
    describe('when updateIntervalVariableOptions is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var interval, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        interval = intervalBuilder().withId('0').withQuery('1s,1m,1h,1d').withAuto(false).build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
                                .whenAsyncActionIsDispatched(updateIntervalVariableOptions(toVariableIdentifier(interval)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(createIntervalOptions({ type: 'interval', id: '0', data: undefined }), setCurrentVariableValue({
                            type: 'interval',
                            id: '0',
                            data: { option: { text: '1s', value: '1s', selected: false } },
                        }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when updateOptions is dispatched but something throws', function () {
        silenceConsoleOutput();
        it('then an notifyApp action should be dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var timeSrvMock, originalTimeSrv, interval, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timeSrvMock = {
                            timeRange: jest.fn().mockReturnValue({
                                from: dateTime(new Date()).subtract(1, 'days').toDate(),
                                to: new Date(),
                                raw: {
                                    from: 'now-1d',
                                    to: 'now',
                                },
                            }),
                        };
                        originalTimeSrv = getTimeSrv();
                        setTimeSrv(timeSrvMock);
                        interval = intervalBuilder()
                            .withId('0')
                            .withQuery('1s,1m,1h,1d')
                            .withAuto(true)
                            .withAutoMin('1xyz') // illegal interval string
                            .build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
                                .whenAsyncActionIsDispatched(updateOptions(toVariableIdentifier(interval)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                            var expectedNumberOfActions = 4;
                            expect(dispatchedActions[0]).toEqual(variableStateFetching(toVariablePayload(interval)));
                            expect(dispatchedActions[1]).toEqual(createIntervalOptions(toVariablePayload(interval)));
                            expect(dispatchedActions[2]).toEqual(variableStateFailed(toVariablePayload(interval, {
                                error: new Error('Invalid interval string, has to be either unit-less or end with one of the following units: "y, M, w, d, h, m, s, ms"'),
                            })));
                            expect(dispatchedActions[3].type).toEqual(notifyApp.type);
                            expect(dispatchedActions[3].payload.title).toEqual('Templating [0]');
                            expect(dispatchedActions[3].payload.text).toEqual('Error updating options: Invalid interval string, has to be either unit-less or end with one of the following units: "y, M, w, d, h, m, s, ms"');
                            expect(dispatchedActions[3].payload.severity).toEqual('error');
                            return dispatchedActions.length === expectedNumberOfActions;
                        });
                        setTimeSrv(originalTimeSrv);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when updateAutoValue is dispatched', function () {
        describe('and auto is false', function () {
            it('then no dependencies are called', function () { return __awaiter(void 0, void 0, void 0, function () {
                var interval, dependencies;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            interval = intervalBuilder().withId('0').withAuto(false).build();
                            dependencies = {
                                calculateInterval: jest.fn(),
                                getTimeSrv: function () {
                                    return {
                                        timeRange: jest.fn().mockReturnValue({
                                            from: '2001-01-01',
                                            to: '2001-01-02',
                                            raw: {
                                                from: '2001-01-01',
                                                to: '2001-01-02',
                                            },
                                        }),
                                    };
                                },
                                templateSrv: {
                                    setGrafanaVariable: jest.fn(),
                                },
                            };
                            return [4 /*yield*/, reduxTester()
                                    .givenRootReducer(getRootReducer())
                                    .whenActionIsDispatched(addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
                                    .whenAsyncActionIsDispatched(updateAutoValue(toVariableIdentifier(interval), dependencies), true)];
                        case 1:
                            _a.sent();
                            expect(dependencies.calculateInterval).toHaveBeenCalledTimes(0);
                            expect(dependencies.getTimeSrv().timeRange).toHaveBeenCalledTimes(0);
                            expect(dependencies.templateSrv.setGrafanaVariable).toHaveBeenCalledTimes(0);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and auto is true', function () {
            it('then correct dependencies are called', function () { return __awaiter(void 0, void 0, void 0, function () {
                var interval, timeRangeMock, setGrafanaVariableMock, dependencies;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            interval = intervalBuilder()
                                .withId('0')
                                .withName('intervalName')
                                .withAuto(true)
                                .withAutoCount(33)
                                .withAutoMin('13s')
                                .build();
                            timeRangeMock = jest.fn().mockReturnValue({
                                from: '2001-01-01',
                                to: '2001-01-02',
                                raw: {
                                    from: '2001-01-01',
                                    to: '2001-01-02',
                                },
                            });
                            setGrafanaVariableMock = jest.fn();
                            dependencies = {
                                calculateInterval: jest.fn().mockReturnValue({ interval: '10s' }),
                                getTimeSrv: function () {
                                    return {
                                        timeRange: timeRangeMock,
                                    };
                                },
                                templateSrv: {
                                    setGrafanaVariable: setGrafanaVariableMock,
                                },
                            };
                            return [4 /*yield*/, reduxTester()
                                    .givenRootReducer(getRootReducer())
                                    .whenActionIsDispatched(addVariable(toVariablePayload(interval, { global: false, index: 0, model: interval })))
                                    .whenAsyncActionIsDispatched(updateAutoValue(toVariableIdentifier(interval), dependencies), true)];
                        case 1:
                            _a.sent();
                            expect(dependencies.calculateInterval).toHaveBeenCalledTimes(1);
                            expect(dependencies.calculateInterval).toHaveBeenCalledWith({
                                from: '2001-01-01',
                                to: '2001-01-02',
                                raw: {
                                    from: '2001-01-01',
                                    to: '2001-01-02',
                                },
                            }, 33, '13s');
                            expect(timeRangeMock).toHaveBeenCalledTimes(1);
                            expect(setGrafanaVariableMock).toHaveBeenCalledTimes(2);
                            expect(setGrafanaVariableMock.mock.calls[0][0]).toBe('$__auto_interval_intervalName');
                            expect(setGrafanaVariableMock.mock.calls[0][1]).toBe('10s');
                            expect(setGrafanaVariableMock.mock.calls[1][0]).toBe('$__auto_interval');
                            expect(setGrafanaVariableMock.mock.calls[1][1]).toBe('10s');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=actions.test.js.map