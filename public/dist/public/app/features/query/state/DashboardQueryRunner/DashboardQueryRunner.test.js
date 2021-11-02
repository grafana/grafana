import { __assign, __awaiter, __generator } from "tslib";
import { throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { setDataSourceSrv } from '@grafana/runtime';
import { AlertState } from '@grafana/data';
import * as annotationsSrv from '../../../annotations/annotations_srv';
import { getDefaultOptions, LEGACY_DS_NAME, NEXT_GEN_DS_NAME, toAsyncOfResult } from './testHelpers';
import { backendSrv } from '../../../../core/services/backend_srv';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import { createDashboardQueryRunner } from './DashboardQueryRunner';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
function getTestContext() {
    var _this = this;
    jest.clearAllMocks();
    var timeSrvMock = { timeRange: jest.fn() };
    var options = getDefaultOptions();
    // These tests are setup so all the workers and runners are invoked once, this wouldn't be the case in real life
    var runner = createDashboardQueryRunner({ dashboard: options.dashboard, timeSrv: timeSrvMock });
    var getResults = [
        { id: 1, state: AlertState.Alerting, dashboardId: 1, panelId: 1 },
        { id: 2, state: AlertState.Alerting, dashboardId: 1, panelId: 2 },
    ];
    var getMock = jest.spyOn(backendSrv, 'get').mockResolvedValue(getResults);
    var executeAnnotationQueryMock = jest
        .spyOn(annotationsSrv, 'executeAnnotationQuery')
        .mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }));
    var annotationQueryMock = jest.fn().mockResolvedValue([{ id: 'Legacy' }]);
    var dataSourceSrvMock = {
        get: function (name) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (name === LEGACY_DS_NAME) {
                    return [2 /*return*/, {
                            annotationQuery: annotationQueryMock,
                        }];
                }
                if (name === NEXT_GEN_DS_NAME) {
                    return [2 /*return*/, {
                            annotations: {},
                        }];
                }
                return [2 /*return*/, {}];
            });
        }); },
    };
    setDataSourceSrv(dataSourceSrvMock);
    return { runner: runner, options: options, annotationQueryMock: annotationQueryMock, executeAnnotationQueryMock: executeAnnotationQueryMock, getMock: getMock };
}
function expectOnResults(args) {
    var runner = args.runner, done = args.done, panelId = args.panelId, expectCallback = args.expect;
    var subscription = runner.getResult(panelId).subscribe({
        next: function (value) {
            try {
                expectCallback(value);
                subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe();
                done();
            }
            catch (err) {
                subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe();
                done.fail(err);
            }
        },
    });
}
describe('DashboardQueryRunnerImpl', function () {
    describe('when calling run and all workers succeed', function () {
        it('then it should return the correct results', function (done) {
            var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
            expectOnResults({
                runner: runner,
                panelId: 1,
                done: done,
                expect: function (results) {
                    // should have one alert state, one snapshot, one legacy and one next gen result
                    // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                    expect(results).toEqual(getExpectedForAllResult());
                    expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(getMock).toHaveBeenCalledTimes(1);
                },
            });
            runner.run(options);
        });
    });
    describe('when calling run and all workers succeed but take longer than 200ms', function () {
        it('then it should return the empty results', function (done) {
            var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
            var wait = 201;
            executeAnnotationQueryMock.mockReturnValue(toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(wait)));
            expectOnResults({
                runner: runner,
                panelId: 1,
                done: done,
                expect: function (results) {
                    // should have one alert state, one snapshot, one legacy and one next gen result
                    // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                    expect(results).toEqual({ annotations: [] });
                    expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(getMock).toHaveBeenCalledTimes(1);
                },
            });
            runner.run(options);
        });
    });
    describe('when calling run and all workers succeed but the subscriber subscribes after the run', function () {
        it('then it should return the last results', function (done) {
            var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
            runner.run(options);
            setTimeout(function () {
                return expectOnResults({
                    runner: runner,
                    panelId: 1,
                    done: done,
                    expect: function (results) {
                        // should have one alert state, one snapshot, one legacy and one next gen result
                        // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                        expect(results).toEqual(getExpectedForAllResult());
                        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                        expect(getMock).toHaveBeenCalledTimes(1);
                    },
                });
            }, 200); // faking a late subscriber to make sure we get the latest results
        });
    });
    describe('when calling run and all workers fail', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function (done) {
            var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
            getMock.mockRejectedValue({ message: 'Get error' });
            annotationQueryMock.mockRejectedValue({ message: 'Legacy error' });
            executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'NextGen error' }));
            expectOnResults({
                runner: runner,
                panelId: 1,
                done: done,
                expect: function (results) {
                    // should have one alert state, one snapshot, one legacy and one next gen result
                    // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                    var expected = { alertState: undefined, annotations: [getExpectedForAllResult().annotations[2]] };
                    expect(results).toEqual(expected);
                    expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(getMock).toHaveBeenCalledTimes(1);
                },
            });
            runner.run(options);
        });
    });
    describe('when calling run and AlertStatesWorker fails', function () {
        silenceConsoleOutput();
        it('then it should return the correct results', function (done) {
            var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
            getMock.mockRejectedValue({ message: 'Get error' });
            expectOnResults({
                runner: runner,
                panelId: 1,
                done: done,
                expect: function (results) {
                    // should have one alert state, one snapshot, one legacy and one next gen result
                    // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                    var annotations = getExpectedForAllResult().annotations;
                    var expected = { alertState: undefined, annotations: annotations };
                    expect(results).toEqual(expected);
                    expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(getMock).toHaveBeenCalledTimes(1);
                },
            });
            runner.run(options);
        });
        describe('when calling run and AnnotationsWorker fails', function () {
            silenceConsoleOutput();
            it('then it should return the correct results', function (done) {
                var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
                annotationQueryMock.mockRejectedValue({ message: 'Legacy error' });
                executeAnnotationQueryMock.mockReturnValue(throwError({ message: 'NextGen error' }));
                expectOnResults({
                    runner: runner,
                    panelId: 1,
                    done: done,
                    expect: function (results) {
                        // should have one alert state, one snapshot, one legacy and one next gen result
                        // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                        var _a = getExpectedForAllResult(), alertState = _a.alertState, annotations = _a.annotations;
                        var expected = { alertState: alertState, annotations: [annotations[2]] };
                        expect(results).toEqual(expected);
                        expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                        expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                        expect(getMock).toHaveBeenCalledTimes(1);
                    },
                });
                runner.run(options);
            });
        });
    });
    describe('when calling run twice', function () {
        it('then it should cancel previous run', function (done) {
            var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
            executeAnnotationQueryMock.mockReturnValueOnce(toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(10000)));
            expectOnResults({
                runner: runner,
                panelId: 1,
                done: done,
                expect: function (results) {
                    // should have one alert state, one snapshot, one legacy and one next gen result
                    // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                    var _a = getExpectedForAllResult(), alertState = _a.alertState, annotations = _a.annotations;
                    var expected = { alertState: alertState, annotations: annotations };
                    expect(results).toEqual(expected);
                    expect(annotationQueryMock).toHaveBeenCalledTimes(2);
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(2);
                    expect(getMock).toHaveBeenCalledTimes(2);
                },
            });
            runner.run(options);
            runner.run(options);
        });
    });
    describe('when calling cancel', function () {
        it('then it should cancel matching workers', function (done) {
            var _a = getTestContext(), runner = _a.runner, options = _a.options, annotationQueryMock = _a.annotationQueryMock, executeAnnotationQueryMock = _a.executeAnnotationQueryMock, getMock = _a.getMock;
            executeAnnotationQueryMock.mockReturnValueOnce(toAsyncOfResult({ events: [{ id: 'NextGen' }] }).pipe(delay(10000)));
            expectOnResults({
                runner: runner,
                panelId: 1,
                done: done,
                expect: function (results) {
                    // should have one alert state, one snapshot, one legacy and one next gen result
                    // having both snapshot and legacy/next gen is a imaginary example for testing purposes and doesn't exist for real
                    var _a = getExpectedForAllResult(), alertState = _a.alertState, annotations = _a.annotations;
                    expect(results).toEqual({ alertState: alertState, annotations: [annotations[0], annotations[2]] });
                    expect(annotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(executeAnnotationQueryMock).toHaveBeenCalledTimes(1);
                    expect(getMock).toHaveBeenCalledTimes(1);
                },
            });
            runner.run(options);
            setTimeout(function () {
                // call to async needs to be async or the cancellation will be called before any of the workers have started
                runner.cancel(options.dashboard.annotations.list[1]);
            }, 100);
        });
    });
});
function getExpectedForAllResult() {
    return {
        alertState: {
            dashboardId: 1,
            id: 1,
            panelId: 1,
            state: AlertState.Alerting,
        },
        annotations: [
            {
                color: '#ffc0cb',
                id: 'Legacy',
                isRegion: false,
                source: {
                    datasource: 'Legacy',
                    enable: true,
                    hide: false,
                    iconColor: 'pink',
                    id: undefined,
                    name: 'Test',
                    snapshotData: undefined,
                },
                type: 'Test',
            },
            {
                color: '#ffc0cb',
                id: 'NextGen',
                isRegion: false,
                source: {
                    datasource: 'NextGen',
                    enable: true,
                    hide: false,
                    iconColor: 'pink',
                    id: undefined,
                    name: 'Test',
                    snapshotData: undefined,
                },
                type: 'Test',
            },
            {
                annotation: {
                    datasource: 'Legacy',
                    enable: true,
                    hide: false,
                    iconColor: 'pink',
                    id: 'Snapshotted',
                    name: 'Test',
                },
                color: '#ffc0cb',
                isRegion: true,
                source: {
                    datasource: 'Legacy',
                    enable: true,
                    hide: false,
                    iconColor: 'pink',
                    id: 'Snapshotted',
                    name: 'Test',
                },
                time: 1,
                timeEnd: 2,
                type: 'Test',
            },
        ],
    };
}
//# sourceMappingURL=DashboardQueryRunner.test.js.map