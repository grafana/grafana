import { __awaiter, __generator } from "tslib";
import { dateTime, LoadingState, DataTopic, } from '@grafana/data';
import { Observable } from 'rxjs';
import { runRequest } from './runRequest';
import { deepFreeze } from '../../../../test/core/redux/reducerTester';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
import { setEchoSrv } from '@grafana/runtime';
import { Echo } from '../../../core/services/echo/Echo';
jest.mock('app/core/services/backend_srv');
var dashboardModel = new DashboardModel({
    panels: [{ id: 1, type: 'graph' }],
});
jest.mock('app/features/dashboard/services/DashboardSrv', function () { return ({
    getDashboardSrv: function () {
        return {
            getCurrent: function () { return dashboardModel; },
        };
    },
}); });
var ScenarioCtx = /** @class */ (function () {
    function ScenarioCtx() {
        this.isUnsubbed = false;
        this.setupFn = function () { };
        this.wasStarted = false;
        this.error = null;
        this.toStartTime = dateTime();
        this.fromStartTime = dateTime();
    }
    ScenarioCtx.prototype.reset = function () {
        var _this = this;
        this.wasStarted = false;
        this.isUnsubbed = false;
        this.results = [];
        this.request = {
            range: {
                from: this.fromStartTime,
                to: this.toStartTime,
                raw: { from: '1h', to: 'now' },
            },
            targets: [
                {
                    refId: 'A',
                },
            ],
        };
        this.ds = {
            query: function (request) {
                return new Observable(function (subscriber) {
                    _this.subscriber = subscriber;
                    _this.wasStarted = true;
                    if (_this.error) {
                        throw _this.error;
                    }
                    return function () {
                        _this.isUnsubbed = true;
                    };
                });
            },
        };
    };
    ScenarioCtx.prototype.start = function () {
        var _this = this;
        this.subscription = runRequest(this.ds, this.request).subscribe({
            next: function (data) {
                _this.results.push(data);
            },
        });
    };
    ScenarioCtx.prototype.emitPacket = function (packet) {
        this.subscriber.next(packet);
    };
    ScenarioCtx.prototype.setup = function (fn) {
        this.setupFn = fn;
    };
    return ScenarioCtx;
}());
function runRequestScenario(desc, fn) {
    describe(desc, function () {
        var ctx = new ScenarioCtx();
        beforeEach(function () {
            setEchoSrv(new Echo());
            ctx.reset();
            return ctx.setupFn();
        });
        fn(ctx);
    });
}
describe('runRequest', function () {
    runRequestScenario('with no queries', function (ctx) {
        ctx.setup(function () {
            ctx.request.targets = [];
            ctx.start();
        });
        it('should emit empty result with loading state done', function () {
            expect(ctx.wasStarted).toBe(false);
            expect(ctx.results[0].state).toBe(LoadingState.Done);
        });
    });
    runRequestScenario('After first response', function (ctx) {
        ctx.setup(function () {
            ctx.start();
            ctx.emitPacket({
                data: [{ name: 'Data' }],
            });
        });
        it('should emit single result with loading state done', function () {
            expect(ctx.wasStarted).toBe(true);
            expect(ctx.results.length).toBe(1);
        });
    });
    runRequestScenario('After tree responses, 2 with different keys', function (ctx) {
        ctx.setup(function () {
            ctx.start();
            ctx.emitPacket({
                data: [{ name: 'DataA-1' }],
                key: 'A',
            });
            ctx.emitPacket({
                data: [{ name: 'DataA-2' }],
                key: 'A',
            });
            ctx.emitPacket({
                data: [{ name: 'DataB-1' }],
                key: 'B',
            });
        });
        it('should emit 3 separate results', function () {
            expect(ctx.results.length).toBe(3);
        });
        it('should combine results and return latest data for key A', function () {
            expect(ctx.results[2].series).toEqual([{ name: 'DataA-2' }, { name: 'DataB-1' }]);
        });
        it('should have loading state Done', function () {
            expect(ctx.results[2].state).toEqual(LoadingState.Done);
        });
    });
    runRequestScenario('After response with state Streaming', function (ctx) {
        ctx.setup(function () {
            ctx.start();
            ctx.emitPacket({
                data: [{ name: 'DataA-1' }],
                key: 'A',
            });
            ctx.emitPacket({
                data: [{ name: 'DataA-2' }],
                key: 'A',
                state: LoadingState.Streaming,
            });
        });
        it('should have loading state Streaming', function () {
            expect(ctx.results[1].state).toEqual(LoadingState.Streaming);
        });
    });
    runRequestScenario('If no response after 250ms', function (ctx) {
        ctx.setup(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.start();
                        return [4 /*yield*/, sleep(250)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should emit 1 result with loading state', function () {
            expect(ctx.results.length).toBe(1);
            expect(ctx.results[0].state).toBe(LoadingState.Loading);
        });
    });
    runRequestScenario('on thrown error', function (ctx) {
        ctx.setup(function () {
            ctx.error = new Error('Ohh no');
            ctx.start();
        });
        it('should emit 1 error result', function () {
            var _a;
            expect((_a = ctx.results[0].error) === null || _a === void 0 ? void 0 : _a.message).toBe('Ohh no');
            expect(ctx.results[0].state).toBe(LoadingState.Error);
        });
    });
    runRequestScenario('If time range is relative', function (ctx) {
        ctx.setup(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // any changes to ctx.request.range will throw and state would become LoadingState.Error
                        deepFreeze(ctx.request.range);
                        ctx.start();
                        // wait a bit
                        return [4 /*yield*/, sleep(20)];
                    case 1:
                        // wait a bit
                        _a.sent();
                        ctx.emitPacket({ data: [{ name: 'DataB-1' }], state: LoadingState.Streaming });
                        return [2 /*return*/];
                }
            });
        }); });
        it('should add the correct timeRange property and the request range should not be mutated', function () {
            var _a, _b;
            expect(ctx.results[0].timeRange.to.valueOf()).toBeDefined();
            expect(ctx.results[0].timeRange.to.valueOf()).not.toBe(ctx.toStartTime.valueOf());
            expect(ctx.results[0].timeRange.to.valueOf()).not.toBe((_b = (_a = ctx.results[0].request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.to.valueOf());
            expectThatRangeHasNotMutated(ctx);
        });
    });
    runRequestScenario('If time range is not relative', function (ctx) {
        ctx.setup(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.request.range.raw.from = ctx.fromStartTime;
                        ctx.request.range.raw.to = ctx.toStartTime;
                        // any changes to ctx.request.range will throw and state would become LoadingState.Error
                        deepFreeze(ctx.request.range);
                        ctx.start();
                        // wait a bit
                        return [4 /*yield*/, sleep(20)];
                    case 1:
                        // wait a bit
                        _a.sent();
                        ctx.emitPacket({ data: [{ name: 'DataB-1' }] });
                        return [2 /*return*/];
                }
            });
        }); });
        it('should add the correct timeRange property and the request range should not be mutated', function () {
            var _a, _b;
            expect(ctx.results[0].timeRange).toBeDefined();
            expect(ctx.results[0].timeRange.to.valueOf()).toBe(ctx.toStartTime.valueOf());
            expect(ctx.results[0].timeRange.to.valueOf()).toBe((_b = (_a = ctx.results[0].request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.to.valueOf());
            expectThatRangeHasNotMutated(ctx);
        });
    });
    runRequestScenario('With annotations dataTopic', function (ctx) {
        ctx.setup(function () {
            ctx.start();
            ctx.emitPacket({
                data: [{ name: 'DataA-1' }],
                key: 'A',
            });
            ctx.emitPacket({
                data: [{ name: 'DataA-2', meta: { dataTopic: DataTopic.Annotations } }],
                key: 'B',
            });
        });
        it('should separate annotations results', function () {
            var _a;
            expect((_a = ctx.results[1].annotations) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
            expect(ctx.results[1].series.length).toBe(1);
        });
    });
});
var expectThatRangeHasNotMutated = function (ctx) {
    var _a, _b;
    // Make sure that the range for request is not changed and that deepfreeze hasn't thrown
    expect((_b = (_a = ctx.results[0].request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.to.valueOf()).toBe(ctx.toStartTime.valueOf());
    expect(ctx.results[0].error).not.toBeDefined();
};
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    setTimeout(resolve, ms);
                })];
        });
    });
}
//# sourceMappingURL=runRequest.test.js.map