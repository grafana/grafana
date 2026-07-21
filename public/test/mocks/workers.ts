import { type Config } from 'app/plugins/panel/nodeGraph/layout';
import { type EdgeDatum, type NodeDatum } from 'app/plugins/panel/nodeGraph/types';

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

// JSDOM does not support Workers and the factory uses import.meta.url which
// cannot be used in CommonJS modules. Uses __mocks__/createRouteGroupsMatcherWorker.ts.
jest.mock('../../app/features/alerting/unified/createRouteGroupsMatcherWorker');
