import { __awaiter, __generator } from "tslib";
import { createGraphFrames } from './graphTransform';
import { testResponse, testResponseEdgesFields, testResponseNodesFields, toEdgesFrame, toNodesFrame, } from './testResponse';
describe('createGraphFrames', function () {
    it('transforms basic response into nodes and edges frame', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frames;
        return __generator(this, function (_a) {
            frames = createGraphFrames(testResponse);
            expect(frames.length).toBe(2);
            expect(frames[0].fields).toMatchObject(testResponseNodesFields);
            expect(frames[1].fields).toMatchObject(testResponseEdgesFields);
            return [2 /*return*/];
        });
    }); });
    it('handles single span response', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frames;
        return __generator(this, function (_a) {
            frames = createGraphFrames(singleSpanResponse);
            expect(frames.length).toBe(2);
            expect(frames[0].fields).toMatchObject(toNodesFrame([
                ['3fa414edcef6ad90'],
                ['tempo-querier'],
                ['HTTP GET - api_traces_traceid'],
                ['1049.14ms (100%)'],
                ['1049.14ms (100%)'],
                [1],
            ]));
            expect(frames[1].fields).toMatchObject(toEdgesFrame([[], [], []]));
            return [2 /*return*/];
        });
    }); });
    it('handles missing spans', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frames;
        return __generator(this, function (_a) {
            frames = createGraphFrames(missingSpanResponse);
            expect(frames.length).toBe(2);
            expect(frames[0].length).toBe(2);
            expect(frames[1].length).toBe(0);
            return [2 /*return*/];
        });
    }); });
});
export var singleSpanResponse = [
    {
        traceId: '3fa414edcef6ad90',
        id: '3fa414edcef6ad90',
        name: 'HTTP GET - api_traces_traceid',
        timestamp: 1605873894680409,
        duration: 1049141,
        tags: {
            component: 'gRPC',
            spanKind: 'client',
        },
        localEndpoint: {
            serviceName: 'tempo-querier',
        },
    },
];
export var missingSpanResponse = [
    {
        traceId: '3fa414edcef6ad90',
        id: '1',
        name: 'HTTP GET - api_traces_traceid',
        timestamp: 1605873894680409,
        duration: 1049141,
    },
    {
        traceId: '3fa414edcef6ad90',
        id: '2',
        name: 'HTTP GET - api_traces_traceid',
        parentId: '3',
        timestamp: 1605873894680409,
        duration: 1049141,
    },
];
//# sourceMappingURL=graphTransform.test.js.map