import { Config } from '../layout';
import { EdgeDatum, NodeDatum } from '../types';

const { layout } = jest.requireActual('../layout.worker.js');

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

jest.mock('./createLayoutWorker', () => ({
  createWorker: () => new LayoutMockWorker(),
}));
