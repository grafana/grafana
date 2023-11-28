import { __awaiter } from "tslib";
import { createGraphFrames } from './graphTransform';
import { testResponse, testResponseEdgesFields, testResponseNodesFields, toEdgesFrame, toNodesFrame, } from './testResponse';
describe('createGraphFrames', () => {
    it('transforms basic response into nodes and edges frame', () => __awaiter(void 0, void 0, void 0, function* () {
        const frames = createGraphFrames(testResponse);
        expect(frames.length).toBe(2);
        expect(frames[0].fields).toMatchObject(testResponseNodesFields);
        expect(frames[1].fields).toMatchObject(testResponseEdgesFields);
    }));
    it('handles single span response', () => __awaiter(void 0, void 0, void 0, function* () {
        const frames = createGraphFrames(singleSpanResponse);
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
    }));
    it('handles missing spans', () => __awaiter(void 0, void 0, void 0, function* () {
        const frames = createGraphFrames(missingSpanResponse);
        expect(frames.length).toBe(2);
        expect(frames[0].length).toBe(2);
        expect(frames[1].length).toBe(0);
    }));
});
export const singleSpanResponse = [
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
export const missingSpanResponse = [
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