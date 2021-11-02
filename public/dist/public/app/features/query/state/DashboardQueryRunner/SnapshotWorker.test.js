import { __assign, __awaiter, __generator } from "tslib";
import { getDefaultTimeRange } from '@grafana/data';
import { SnapshotWorker } from './SnapshotWorker';
function getDefaultOptions() {
    var dashboard = {};
    var range = getDefaultTimeRange();
    return { dashboard: dashboard, range: range };
}
function getSnapshotData(annotation, timeEnd) {
    if (timeEnd === void 0) { timeEnd = undefined; }
    return [{ annotation: annotation, source: {}, timeEnd: timeEnd, time: 1 }];
}
function getAnnotation(timeEnd) {
    if (timeEnd === void 0) { timeEnd = undefined; }
    var annotation = {
        enable: true,
        hide: false,
        name: 'Test',
        iconColor: 'pink',
    };
    return __assign(__assign({}, annotation), { snapshotData: getSnapshotData(annotation, timeEnd) });
}
describe('SnapshotWorker', function () {
    var worker = new SnapshotWorker();
    describe('when canWork is called with correct props', function () {
        it('then it should return true', function () {
            var dashboard = { annotations: { list: [getAnnotation(), {}] } };
            var options = __assign(__assign({}, getDefaultOptions()), { dashboard: dashboard });
            expect(worker.canWork(options)).toBe(true);
        });
    });
    describe('when canWork is called with incorrect props', function () {
        it('then it should return false', function () {
            var dashboard = { annotations: { list: [{}] } };
            var options = __assign(__assign({}, getDefaultOptions()), { dashboard: dashboard });
            expect(worker.canWork(options)).toBe(false);
        });
    });
    describe('when run is called with incorrect props', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dashboard, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dashboard = { annotations: { list: [{}] } };
                        options = __assign(__assign({}, getDefaultOptions()), { dashboard: dashboard });
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValues([{ alertStates: [], annotations: [] }])];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when run is called with correct props', function () {
        it('then it should return the correct results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var noRegionUndefined, noRegionEqualTime, region, noSnapshotData, dashboard, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        noRegionUndefined = getAnnotation();
                        noRegionEqualTime = getAnnotation(1);
                        region = getAnnotation(2);
                        noSnapshotData = __assign(__assign({}, getAnnotation()), { snapshotData: undefined });
                        dashboard = { annotations: { list: [noRegionUndefined, region, noSnapshotData, noRegionEqualTime] } };
                        options = __assign(__assign({}, getDefaultOptions()), { dashboard: dashboard });
                        return [4 /*yield*/, expect(worker.work(options)).toEmitValuesWith(function (received) {
                                expect(received).toHaveLength(1);
                                var _a = received[0], alertStates = _a.alertStates, annotations = _a.annotations;
                                expect(alertStates).toBeDefined();
                                expect(annotations).toHaveLength(3);
                                expect(annotations[0]).toEqual({
                                    annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                                    source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                                    timeEnd: undefined,
                                    time: 1,
                                    color: '#ffc0cb',
                                    type: 'Test',
                                    isRegion: false,
                                });
                                expect(annotations[1]).toEqual({
                                    annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                                    source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                                    timeEnd: 2,
                                    time: 1,
                                    color: '#ffc0cb',
                                    type: 'Test',
                                    isRegion: true,
                                });
                                expect(annotations[2]).toEqual({
                                    annotation: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                                    source: { enable: true, hide: false, name: 'Test', iconColor: 'pink' },
                                    timeEnd: 1,
                                    time: 1,
                                    color: '#ffc0cb',
                                    type: 'Test',
                                    isRegion: false,
                                });
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=SnapshotWorker.test.js.map