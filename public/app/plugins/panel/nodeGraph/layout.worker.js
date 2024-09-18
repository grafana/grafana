import { layout } from './forceLayout';

// Separate from main implementation so it does not trip out tests
addEventListener('message', (event) => {
  const { nodes, edges, config } = event.data;
  layout(nodes, edges, config);
  postMessage({ nodes, edges });
});
