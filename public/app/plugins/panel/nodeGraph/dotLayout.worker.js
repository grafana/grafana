import { Graphviz } from '@hpcc-js/wasm/graphviz';

let graphviz;

addEventListener('message', async (event) => {
  if (!graphviz) {
    graphviz = await Graphviz.load();
  }
  const { nodes, edges, config } = event.data;
  const [newNodes, newEdges] = layout(nodes, edges, config);
  postMessage({ nodes: newNodes, edges: newEdges });
});

/**
 * Use d3 force layout to lay the nodes in a sensible way. This function modifies the nodes adding the x,y positions
 * and also fills in node references in edges instead of node ids.
 */
export function layout(nodes, edges) {
  const mappedEdges = [];
  const idToDOTMap = {};
  const DOTToIdMap = {};

  let index = 0;
  for (const edge of edges) {
    if (!idToDOTMap[edge.source]) {
      idToDOTMap[edge.source] = index.toString(10);
      DOTToIdMap[index.toString(10)] = edge.source;
      index++;
    }

    if (!idToDOTMap[edge.target]) {
      idToDOTMap[edge.target] = index.toString(10);
      DOTToIdMap[index.toString(10)] = edge.target;
      index++;
    }
    mappedEdges.push({ source: idToDOTMap[edge.source], target: idToDOTMap[edge.target] });
  }

  console.time('layout');
  const dot = edgesToDOT(mappedEdges);
  const dotLayout = JSON.parse(graphviz.dot(dot, 'json0'));
  console.timeEnd('layout');

  const nodesMap = dotLayout.objects.reduce((acc, obj) => {
    acc[DOTToIdMap[obj.name]] = {
      obj,
    };
    return acc;
  }, {});

  for (const node of nodes) {
    nodesMap[node.id] = {
      ...nodesMap[node.id],
      datum: {
        ...node,
        x: parseFloat(nodesMap[node.id].obj.pos.split(',')[0]),
        y: parseFloat(nodesMap[node.id].obj.pos.split(',')[1]),
      },
    };
  }
  const edgesMapped = edges.map((e) => {
    return {
      ...e,
      source: nodesMap[e.source].datum,
      target: nodesMap[e.target].datum,
    };
  });

  return [Object.values(nodesMap).map((v) => v.datum), edges];
}

function toDOT(edges, graphAttr = '', edgeAttr = '') {
  let dot = `
  digraph G {
    ${graphAttr}
  `;
  for (const edge of edges) {
    dot += edge.source + '->' + edge.target + ' ' + edgeAttr + '\n';
  }
  dot += nodesDOT(edges);
  dot += '}';
  return dot;
}

function edgesToDOT(edges) {
  return toDOT(edges, '', '[ minlen=3 ]');
}

function nodesDOT(edges) {
  let dot = '';
  const visitedNodes = new Set();
  const attr = '[fixedsize=true, width=1.2, height=1.2] \n';
  for (const edge of edges) {
    if (!visitedNodes.has(edge.source)) {
      dot += edge.source + attr;
    }
    if (!visitedNodes.has(edge.target)) {
      dot += edge.target + attr;
    }
  }
  return dot;
}
