import { layout } from './layeredLayout';

// Separate from main implementation so it does not trip out tests
addEventListener('message', async (event) => {
  const { nodes, edges, config } = event.data;
  const [newNodes, newEdges] = layout(nodes, edges, config);
  postMessage({ nodes: newNodes, edges: newEdges });
});
