const { layout } = jest.requireActual('../layout.worker.js');

export default class TestWorker {
  constructor() {}
  postMessage(data) {
    const { nodes, edges, config } = data;
    setTimeout(() => {
      layout(nodes, edges, config);
      this.onmessage({ data: { nodes, edges } });
    }, 1);
  }
}
