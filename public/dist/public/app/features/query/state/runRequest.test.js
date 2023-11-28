import { __awaiter } from "tslib";
import { Observable } from 'rxjs';
import { DataTopic, dateTime, LoadingState, } from '@grafana/data';
import { setEchoSrv } from '@grafana/runtime';
import { deepFreeze } from '../../../../test/core/redux/reducerTester';
import { Echo } from '../../../core/services/echo/Echo';
import { createDashboardModelFixture } from '../../dashboard/state/__fixtures__/dashboardFixtures';
import { runRequest } from './runRequest';
jest.mock('app/core/services/backend_srv');
const dashboardModel = createDashboardModelFixture({
    panels: [{ id: 1, type: 'graph' }],
});
jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
    getDashboardSrv: () => {
        return {
            getCurrent: () => dashboardModel,
        };
    },
}));
class ScenarioCtx {
    constructor() {
        this.isUnsubbed = false;
        this.setupFn = () => { };
        this.wasStarted = false;
        this.error = null;
        this.toStartTime = dateTime();
        this.fromStartTime = dateTime();
    }
    reset() {
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
            query: (request) => {
                return new Observable((subscriber) => {
                    this.subscriber = subscriber;
                    this.wasStarted = true;
                    if (this.error) {
                        throw this.error;
                    }
                    return () => {
                        this.isUnsubbed = true;
                    };
                });
            },
        };
    }
    start() {
        this.subscription = runRequest(this.ds, this.request).subscribe({
            next: (data) => {
                this.results.push(data);
            },
        });
    }
    emitPacket(packet) {
        this.subscriber.next(packet);
    }
    setup(fn) {
        this.setupFn = fn;
    }
}
function runRequestScenario(desc, fn) {
    describe(desc, () => {
        const ctx = new ScenarioCtx();
        beforeEach(() => {
            setEchoSrv(new Echo());
            ctx.reset();
            return ctx.setupFn();
        });
        fn(ctx);
    });
}
function runRequestScenarioThatThrows(desc, fn) {
    describe(desc, () => {
        const ctx = new ScenarioCtx();
        let consoleSpy;
        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            setEchoSrv(new Echo());
            ctx.reset();
            return ctx.setupFn();
        });
        afterEach(() => {
            consoleSpy.mockRestore();
        });
        fn(ctx);
    });
}
describe('runRequest', () => {
    runRequestScenario('with no queries', (ctx) => {
        ctx.setup(() => {
            ctx.request.targets = [];
            ctx.start();
        });
        it('should emit empty result with loading state done', () => {
            expect(ctx.wasStarted).toBe(false);
            expect(ctx.results[0].state).toBe(LoadingState.Done);
        });
    });
    runRequestScenario('After first response', (ctx) => {
        ctx.setup(() => {
            ctx.start();
            ctx.emitPacket({
                data: [{ name: 'Data' }],
            });
        });
        it('should emit single result with loading state done', () => {
            expect(ctx.wasStarted).toBe(true);
            expect(ctx.results.length).toBe(1);
        });
    });
    runRequestScenario('After three responses, 2 with different keys', (ctx) => {
        ctx.setup(() => {
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
        it('should emit 3 separate results', () => {
            expect(ctx.results.length).toBe(3);
        });
        it('should combine results and return latest data for key A', () => {
            expect(ctx.results[2].series).toEqual([{ name: 'DataA-2' }, { name: 'DataB-1' }]);
        });
        it('should have loading state Done', () => {
            expect(ctx.results[2].state).toEqual(LoadingState.Done);
        });
    });
    runRequestScenario('When the key is defined in refId', (ctx) => {
        ctx.setup(() => {
            ctx.start();
            ctx.emitPacket({
                data: [{ name: 'DataX-1', refId: 'X' }],
            });
            ctx.emitPacket({
                data: [{ name: 'DataY-1', refId: 'Y' }],
            });
            ctx.emitPacket({
                data: [{ name: 'DataY-2', refId: 'Y' }],
            });
        });
        it('should emit 3 separate results', () => {
            expect(ctx.results.length).toBe(3);
        });
        it('should keep data for X and Y', () => {
            expect(ctx.results[2].series).toMatchInlineSnapshot(`
        [
          {
            "name": "DataX-1",
            "refId": "X",
          },
          {
            "name": "DataY-2",
            "refId": "Y",
          },
        ]
      `);
        });
    });
    runRequestScenario('When the response contains traceIds', (ctx) => {
        ctx.setup(() => {
            ctx.start();
            ctx.emitPacket({
                data: [{ name: 'data-a', refId: 'A' }],
            });
            ctx.emitPacket({
                data: [{ name: 'data-b', refId: 'B' }],
            });
            ctx.emitPacket({
                data: [{ name: 'data-c', refId: 'C' }],
                traceIds: ['t1', 't2'],
            });
            ctx.emitPacket({
                data: [{ name: 'data-d', refId: 'D' }],
            });
            ctx.emitPacket({
                data: [{ name: 'data-e', refId: 'E' }],
                traceIds: ['t3', 't4'],
            });
            ctx.emitPacket({
                data: [{ name: 'data-e', refId: 'E' }],
                traceIds: ['t4', 't4'],
            });
        });
        it('should collect traceIds correctly', () => {
            const { results } = ctx;
            expect(results).toHaveLength(6);
            expect(results[0].traceIds).toBeUndefined();
            // this is the result of adding no-traces data to no-traces state
            expect(results[1].traceIds).toBeUndefined();
            // this is the result of adding with-traces data to no-traces state
            expect(results[2].traceIds).toStrictEqual(['t1', 't2']);
            // this is the result of adding no-traces data to with-traces state
            expect(results[3].traceIds).toStrictEqual(['t1', 't2']);
            // this is the result of adding with-traces data to with-traces state
            expect(results[4].traceIds).toStrictEqual(['t1', 't2', 't3', 't4']);
            // this is the result of adding with-traces data to with-traces state with duplicate traceIds
            expect(results[5].traceIds).toStrictEqual(['t1', 't2', 't3', 't4']);
        });
    });
    runRequestScenario('After response with state Streaming', (ctx) => {
        ctx.setup(() => {
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
        it('should have loading state Streaming', () => {
            expect(ctx.results[1].state).toEqual(LoadingState.Streaming);
        });
    });
    runRequestScenario('If no response after 250ms', (ctx) => {
        ctx.setup(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.start();
            yield sleep(250);
        }));
        it('should emit 1 result with loading state', () => {
            expect(ctx.results.length).toBe(1);
            expect(ctx.results[0].state).toBe(LoadingState.Loading);
        });
    });
    runRequestScenarioThatThrows('on thrown error', (ctx) => {
        ctx.setup(() => {
            ctx.error = new Error('Ohh no');
            ctx.start();
        });
        it('should emit 1 error result', () => {
            var _a;
            expect((_a = ctx.results[0].error) === null || _a === void 0 ? void 0 : _a.message).toBe('Ohh no');
            expect(ctx.results[0].state).toBe(LoadingState.Error);
        });
    });
    runRequestScenario('If time range is relative', (ctx) => {
        ctx.setup(() => __awaiter(void 0, void 0, void 0, function* () {
            // any changes to ctx.request.range will throw and state would become LoadingState.Error
            deepFreeze(ctx.request.range);
            ctx.start();
            // wait a bit
            yield sleep(20);
            ctx.emitPacket({ data: [{ name: 'DataB-1' }], state: LoadingState.Streaming });
        }));
        it('should add the correct timeRange property and the request range should not be mutated', () => {
            var _a, _b;
            expect(ctx.results[0].timeRange.to.valueOf()).toBeDefined();
            expect(ctx.results[0].timeRange.to.valueOf()).not.toBe(ctx.toStartTime.valueOf());
            expect(ctx.results[0].timeRange.to.valueOf()).not.toBe((_b = (_a = ctx.results[0].request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.to.valueOf());
            expectThatRangeHasNotMutated(ctx);
        });
    });
    runRequestScenario('If time range is not relative', (ctx) => {
        ctx.setup(() => __awaiter(void 0, void 0, void 0, function* () {
            ctx.request.range.raw.from = ctx.fromStartTime;
            ctx.request.range.raw.to = ctx.toStartTime;
            // any changes to ctx.request.range will throw and state would become LoadingState.Error
            deepFreeze(ctx.request.range);
            ctx.start();
            // wait a bit
            yield sleep(20);
            ctx.emitPacket({ data: [{ name: 'DataB-1' }] });
        }));
        it('should add the correct timeRange property and the request range should not be mutated', () => {
            var _a, _b;
            expect(ctx.results[0].timeRange).toBeDefined();
            expect(ctx.results[0].timeRange.to.valueOf()).toBe(ctx.toStartTime.valueOf());
            expect(ctx.results[0].timeRange.to.valueOf()).toBe((_b = (_a = ctx.results[0].request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.to.valueOf());
            expectThatRangeHasNotMutated(ctx);
        });
    });
    runRequestScenario('With annotations dataTopic', (ctx) => {
        ctx.setup(() => {
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
        it('should separate annotations results', () => {
            var _a;
            expect((_a = ctx.results[1].annotations) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
            expect(ctx.results[1].series.length).toBe(1);
        });
    });
});
const expectThatRangeHasNotMutated = (ctx) => {
    var _a, _b;
    // Make sure that the range for request is not changed and that deepfreeze hasn't thrown
    expect((_b = (_a = ctx.results[0].request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.to.valueOf()).toBe(ctx.toStartTime.valueOf());
    expect(ctx.results[0].error).not.toBeDefined();
};
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    });
}
//# sourceMappingURL=runRequest.test.js.map