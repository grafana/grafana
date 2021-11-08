const { layout } = jest.requireActual('../../app/plugins/panel/nodeGraph/layout.worker.js');

class LayoutMockWorker {
  constructor() {}

  postMessage(data: any) {
    const { nodes, edges, config } = data;
    setTimeout(() => {
      layout(nodes, edges, config);
      // @ts-ignore
      this.onmessage({ data: { nodes, edges } });
    }, 1);
  }
}

jest.mock('../../app/plugins/panel/nodeGraph/createLayoutWorker', () => ({
  createWorker: () => new LayoutMockWorker(),
}));

class BasicMockWorker {
  postMessage() {}
}
const mockCreateWorker = {
  createWorker: () => new BasicMockWorker(),
};

jest.mock('../../app/features/live/centrifuge/createCentrifugeServiceWorker', () => mockCreateWorker);
