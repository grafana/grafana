import { __assign, __awaiter, __generator } from "tslib";
import { dateTime } from '@grafana/data';
import { onTimeRangeUpdated, setOptionAsCurrent } from './actions';
import { createIntervalVariableAdapter } from '../interval/adapter';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { VariableRefresh } from '../types';
import { constantBuilder, intervalBuilder } from '../shared/testing/builders';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer } from './helpers';
import { toVariableIdentifier, toVariablePayload } from './types';
import { setCurrentVariableValue, variableStateCompleted, variableStateFailed, variableStateFetching, } from './sharedReducer';
import { createIntervalOptions } from '../interval/reducer';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { notifyApp } from '../../../core/reducers/appNotification';
import { expect } from '../../../../test/lib/common';
variableAdapters.setInit(function () { return [createIntervalVariableAdapter(), createConstantVariableAdapter()]; });
var getTestContext = function () {
    var interval = intervalBuilder()
        .withId('interval-0')
        .withName('interval-0')
        .withOptions('1m', '10m', '30m', '1h', '6h', '12h', '1d', '7d', '14d', '30d')
        .withCurrent('1m')
        .withRefresh(VariableRefresh.onTimeRangeChanged)
        .build();
    var constant = constantBuilder()
        .withId('constant-1')
        .withName('constant-1')
        .withOptions('a constant')
        .withCurrent('a constant')
        .build();
    var range = {
        from: dateTime(new Date().getTime()).subtract(1, 'minutes'),
        to: dateTime(new Date().getTime()),
        raw: {
            from: 'now-1m',
            to: 'now',
        },
    };
    var updateTimeRangeMock = jest.fn();
    var templateSrvMock = { updateTimeRange: updateTimeRangeMock };
    var dependencies = { templateSrv: templateSrvMock };
    var templateVariableValueUpdatedMock = jest.fn();
    var setChangeAffectsAllPanelsMock = jest.fn();
    var dashboard = {
        getModel: function () {
            return ({
                templateVariableValueUpdated: templateVariableValueUpdatedMock,
                startRefresh: startRefreshMock,
                setChangeAffectsAllPanels: setChangeAffectsAllPanelsMock,
            });
        },
    };
    var startRefreshMock = jest.fn();
    var adapter = variableAdapters.get('interval');
    var preloadedState = {
        dashboard: dashboard,
        templating: {
            variables: {
                'interval-0': __assign({}, interval),
                'constant-1': __assign({}, constant),
            },
        },
    };
    return {
        interval: interval,
        range: range,
        dependencies: dependencies,
        adapter: adapter,
        preloadedState: preloadedState,
        updateTimeRangeMock: updateTimeRangeMock,
        templateVariableValueUpdatedMock: templateVariableValueUpdatedMock,
        startRefreshMock: startRefreshMock,
        setChangeAffectsAllPanelsMock: setChangeAffectsAllPanelsMock,
    };
};
describe('when onTimeRangeUpdated is dispatched', function () {
    describe('and options are changed by update', function () {
        it('then correct actions are dispatched and correct dependencies are called', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, preloadedState, range, dependencies, updateTimeRangeMock, templateVariableValueUpdatedMock, startRefreshMock, setChangeAffectsAllPanelsMock, tester;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), preloadedState = _a.preloadedState, range = _a.range, dependencies = _a.dependencies, updateTimeRangeMock = _a.updateTimeRangeMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock, setChangeAffectsAllPanelsMock = _a.setChangeAffectsAllPanelsMock;
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(onTimeRangeUpdated(range, dependencies))];
                    case 1:
                        tester = _b.sent();
                        tester.thenDispatchedActionsShouldEqual(variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' })), createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' })), setCurrentVariableValue(toVariablePayload({ type: 'interval', id: 'interval-0' }, { option: { text: '1m', value: '1m', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' })));
                        expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
                        expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
                        expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
                        expect(startRefreshMock).toHaveBeenCalledTimes(1);
                        expect(setChangeAffectsAllPanelsMock).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('and options are not changed by update', function () {
        it('then correct actions are dispatched and correct dependencies are called', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, interval, preloadedState, range, dependencies, updateTimeRangeMock, templateVariableValueUpdatedMock, startRefreshMock, setChangeAffectsAllPanelsMock, base, tester;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), interval = _a.interval, preloadedState = _a.preloadedState, range = _a.range, dependencies = _a.dependencies, updateTimeRangeMock = _a.updateTimeRangeMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock, setChangeAffectsAllPanelsMock = _a.setChangeAffectsAllPanelsMock;
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(setOptionAsCurrent(toVariableIdentifier(interval), interval.options[0], false))];
                    case 1:
                        base = _b.sent();
                        return [4 /*yield*/, base.whenAsyncActionIsDispatched(onTimeRangeUpdated(range, dependencies), true)];
                    case 2:
                        tester = _b.sent();
                        tester.thenDispatchedActionsShouldEqual(variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' })), createIntervalOptions(toVariablePayload({ type: 'interval', id: 'interval-0' })), setCurrentVariableValue(toVariablePayload({ type: 'interval', id: 'interval-0' }, { option: { text: '1m', value: '1m', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'interval', id: 'interval-0' })));
                        expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
                        expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
                        expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(0);
                        expect(startRefreshMock).toHaveBeenCalledTimes(1);
                        expect(setChangeAffectsAllPanelsMock).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('and updateOptions throws', function () {
        silenceConsoleOutput();
        it('then correct actions are dispatched and correct dependencies are called', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, adapter, preloadedState, range, dependencies, updateTimeRangeMock, templateVariableValueUpdatedMock, startRefreshMock, setChangeAffectsAllPanelsMock, tester;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), adapter = _a.adapter, preloadedState = _a.preloadedState, range = _a.range, dependencies = _a.dependencies, updateTimeRangeMock = _a.updateTimeRangeMock, templateVariableValueUpdatedMock = _a.templateVariableValueUpdatedMock, startRefreshMock = _a.startRefreshMock, setChangeAffectsAllPanelsMock = _a.setChangeAffectsAllPanelsMock;
                        adapter.updateOptions = jest.fn().mockRejectedValue(new Error('Something broke'));
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState, debug: true })
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(onTimeRangeUpdated(range, dependencies), true)];
                    case 1:
                        tester = _b.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                            expect(dispatchedActions[0]).toEqual(variableStateFetching(toVariablePayload({ type: 'interval', id: 'interval-0' })));
                            expect(dispatchedActions[1]).toEqual(variableStateFailed(toVariablePayload({ type: 'interval', id: 'interval-0' }, { error: new Error('Something broke') })));
                            expect(dispatchedActions[2].type).toEqual(notifyApp.type);
                            expect(dispatchedActions[2].payload.title).toEqual('Templating');
                            expect(dispatchedActions[2].payload.text).toEqual('Template variable service failed Something broke');
                            expect(dispatchedActions[2].payload.severity).toEqual('error');
                            return dispatchedActions.length === 3;
                        });
                        expect(updateTimeRangeMock).toHaveBeenCalledTimes(1);
                        expect(updateTimeRangeMock).toHaveBeenCalledWith(range);
                        expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(0);
                        expect(startRefreshMock).toHaveBeenCalledTimes(0);
                        expect(setChangeAffectsAllPanelsMock).toHaveBeenCalledTimes(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=onTimeRangeUpdated.test.js.map