import { AlertState, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { mergePanelAndDashData } from './mergePanelAndDashData';
import { TestScheduler } from 'rxjs/testing';
function getTestContext() {
    var timeRange = getDefaultTimeRange();
    var panelData = {
        state: LoadingState.Done,
        series: [],
        annotations: [toDataFrame([{ id: 'panelData' }])],
        timeRange: timeRange,
    };
    var scheduler = new TestScheduler(function (actual, expected) {
        expect(actual).toEqual(expected);
    });
    return { timeRange: timeRange, scheduler: scheduler, panelData: panelData };
}
describe('mergePanelAndDashboardData', function () {
    describe('when called and dashboard data contains annotations', function () {
        it('then the annotations should be combined', function () {
            var _a = getTestContext(), panelData = _a.panelData, timeRange = _a.timeRange, scheduler = _a.scheduler;
            scheduler.run(function (_a) {
                var cold = _a.cold, expectObservable = _a.expectObservable;
                var panelObservable = cold('a', { a: panelData });
                var dashObservable = cold('a', { a: { annotations: [{ id: 'dashData' }] } });
                var result = mergePanelAndDashData(panelObservable, dashObservable);
                expectObservable(result).toBe('a', {
                    a: {
                        state: LoadingState.Done,
                        series: [],
                        annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
                        timeRange: timeRange,
                    },
                });
            });
            scheduler.flush();
        });
    });
    describe('when called and dashboard data contains alert states', function () {
        it('then the alert states should be added', function () {
            var _a = getTestContext(), panelData = _a.panelData, timeRange = _a.timeRange, scheduler = _a.scheduler;
            scheduler.run(function (_a) {
                var cold = _a.cold, expectObservable = _a.expectObservable;
                var panelObservable = cold('a', { a: panelData });
                var dashObservable = cold('a', {
                    a: {
                        annotations: [],
                        alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
                    },
                });
                var result = mergePanelAndDashData(panelObservable, dashObservable);
                expectObservable(result).toBe('a', {
                    a: {
                        state: LoadingState.Done,
                        series: [],
                        annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([])],
                        alertState: { id: 1, state: AlertState.OK, dashboardId: 1, panelId: 1, newStateDate: '' },
                        timeRange: timeRange,
                    },
                });
            });
            scheduler.flush();
        });
    });
    describe('when called and dashboard data does not contain annotations or alertState', function () {
        it('then the panelData is unchanged', function () {
            var _a = getTestContext(), panelData = _a.panelData, timeRange = _a.timeRange, scheduler = _a.scheduler;
            scheduler.run(function (_a) {
                var cold = _a.cold, expectObservable = _a.expectObservable;
                var panelObservable = cold('a', { a: panelData });
                var dashObservable = cold('a', {
                    a: {
                        annotations: [],
                    },
                });
                var result = mergePanelAndDashData(panelObservable, dashObservable);
                expectObservable(result).toBe('a', {
                    a: {
                        state: LoadingState.Done,
                        series: [],
                        annotations: [toDataFrame([{ id: 'panelData' }])],
                        timeRange: timeRange,
                    },
                });
            });
            scheduler.flush();
        });
    });
});
//# sourceMappingURL=mergePanelAndDashData.test.js.map