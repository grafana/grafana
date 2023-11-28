"use strict";
const { layout } = jest.requireActual('../../app/plugins/panel/nodeGraph/layout.worker.js');
class LayoutMockWorker {
    constructor() { }
    postMessage(data) {
        const { nodes, edges, config } = data;
        this.timeout = window.setTimeout(() => {
            this.timeout = undefined;
            layout(nodes, edges, config);
            // @ts-ignore
            this.onmessage({ data: { nodes, edges } });
        }, 1);
    }
    terminate() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }
}
jest.mock('../../app/plugins/panel/nodeGraph/createLayoutWorker', () => ({
    createWorker: () => new LayoutMockWorker(),
}));
class BasicMockWorker {
    postMessage() { }
}
const mockCreateWorker = {
    createWorker: () => new BasicMockWorker(),
};
jest.mock('../../app/features/live/centrifuge/createCentrifugeServiceWorker', () => mockCreateWorker);
//# sourceMappingURL=workers.js.map