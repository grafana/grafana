const { layout } = jest.requireActual('../layout.worker.js');

export default class TestWorker {
  constructor() {}
  postMessage(data) {
    const { nodes, edges, config } = data;
    this.timeout = setTimeout(() => {
      this.timeout = null;
      layout(nodes, edges, config);
      this.onmessage({ data: { nodes, edges } });
    }, 1);
  }
  terminate() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}
