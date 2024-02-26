import { layout } from './layout.worker.utils';

addEventListener('message', (event) => {
  const { nodes, edges, config } = event.data;
  layout(nodes, edges, config);
  postMessage({ nodes, edges });
});
