import { Config } from 'app/plugins/panel/nodeGraph/layout';
import { EdgeDatum, NodeDatum } from 'app/plugins/panel/nodeGraph/types';

const { layout } = jest.requireActual('../../app/plugins/panel/nodeGraph/forceLayout.js');

class LayoutMockWorker {
  timeout: number | undefined;
  constructor() {}
  postMessage(data: { nodes: NodeDatum[]; edges: EdgeDatum[]; config: Config }) {
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
