import { __awaiter } from "tslib";
import { renderHook } from '@testing-library/react';
import { useLayout } from './layout';
let onmessage;
let postMessage;
let terminate;
jest.mock('./createLayoutWorker', () => {
    return {
        __esModule: true,
        createWorker: () => {
            onmessage = jest.fn();
            postMessage = jest.fn();
            terminate = jest.fn();
            return {
                onmessage: onmessage,
                postMessage: postMessage,
                terminate: terminate,
            };
        },
    };
});
describe('layout', () => {
    it('doesnt fail without any data', () => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = [];
        const edges = [];
        const { result } = renderHook(() => {
            return useLayout(nodes, edges, undefined, 100, 1000);
        });
        expect(result.current.nodes).toEqual([]);
        expect(result.current.edges).toEqual([]);
        expect(postMessage).toBeUndefined();
    }));
    it('cancels worker', () => __awaiter(void 0, void 0, void 0, function* () {
        const { result, rerender } = renderHook(({ nodes, edges }) => {
            return useLayout(nodes, edges, undefined, 100, 1000);
        }, {
            initialProps: {
                nodes: [makeNode(0, 0), makeNode(1, 1)],
                edges: [makeEdge(0, 1)],
            },
        });
        expect(postMessage).toBeCalledTimes(1);
        // Bit convoluted but we cannot easily access the worker instance as we only export constructor so the default
        // export is class and we only store latest instance of the methods as jest.fn here as module local variables.
        // So we capture the terminate function from current worker so that when we call rerender and new worker is created
        // we can still access and check the method from the old one that we assume should be canceled.
        const localTerminate = terminate;
        rerender({
            nodes: [],
            edges: [],
        });
        expect(result.current.nodes).toEqual([]);
        expect(result.current.edges).toEqual([]);
        expect(localTerminate).toBeCalledTimes(1);
    }));
});
function makeNode(index, incoming) {
    return {
        id: `n${index}`,
        title: `n${index}`,
        subTitle: '',
        dataFrameRowIndex: 0,
        incoming,
        arcSections: [],
    };
}
function makeEdge(source, target) {
    return {
        id: `${source}-${target}`,
        source: 'n' + source,
        target: 'n' + target,
        mainStat: '',
        secondaryStat: '',
        dataFrameRowIndex: 0,
        sourceNodeRadius: 40,
        targetNodeRadius: 40,
    };
}
//# sourceMappingURL=layout.test.js.map