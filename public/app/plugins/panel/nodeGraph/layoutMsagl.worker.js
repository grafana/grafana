import {
  GeomGraph,
  GeomEdge,
  GeomNode,
  Point,
  CurveFactory,
  SugiyamaLayoutSettings,
  LayerDirectionEnum,
  layoutGeomGraph,
} from '@msagl/core';
import { parseDot } from '@msagl/parser';

addEventListener('message', async (event) => {
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

  const dot = edgesToDOT(mappedEdges);
  const graph = parseDot(dot);
  const geomGraph = new GeomGraph(graph);
  for (const e of graph.deepEdges) {
    const gbc = new GeomEdge(e);
  }

  for (const n of graph.nodesBreadthFirst) {
    const gn = new GeomNode(n);
    gn.boundaryCurve = CurveFactory.mkCircle(50, new Point(0, 0));
  }
  geomGraph.layoutSettings = new SugiyamaLayoutSettings();
  geomGraph.layoutSettings.layerDirection = LayerDirectionEnum.BT;
  geomGraph.layoutSettings.LayerSeparation = 60;
  geomGraph.layoutSettings.commonSettings.NodeSeparation = 40;
  layoutGeomGraph(geomGraph);

  const nodesMap = {};
  for (const node of geomGraph.nodesBreadthFirst) {
    nodesMap[DOTToIdMap[node.id]] = {
      obj: node,
    };
  }

  for (const node of nodes) {
    nodesMap[node.id] = {
      ...nodesMap[node.id],
      datum: {
        ...node,
        x: nodesMap[node.id].obj.center.x,
        y: nodesMap[node.id].obj.center.y,
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

  const finalNodes = Object.values(nodesMap).map((v) => v.datum);
  centerNodes(finalNodes);
  console.log({ finalNodes, edgesMapped });
  return [finalNodes, edgesMapped];
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
  return toDOT(edges, 'rankdir="LR"; TBbalance="min"', '[ minlen=3 ]');
}

function nodesDOT(edges) {
  let dot = '';
  const visitedNodes = new Set();
  // TODO: height/width for default sizing but nodes can have variable size now
  const attr = '[fixedsize=true, width=1.2, height=1.7] \n';
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

/**
 * Makes sure that the center of the graph based on its bound is in 0, 0 coordinates.
 * Modifies the nodes directly.
 */
function centerNodes(nodes) {
  const bounds = graphBounds(nodes);
  for (let node of nodes) {
    node.x = node.x - bounds.center.x;
    node.y = node.y - bounds.center.y;
  }
}

/**
 * Get bounds of the graph meaning the extent of the nodes in all directions.
 */
function graphBounds(nodes) {
  if (nodes.length === 0) {
    return { top: 0, right: 0, bottom: 0, left: 0, center: { x: 0, y: 0 } };
  }

  const bounds = nodes.reduce(
    (acc, node) => {
      if (node.x > acc.right) {
        acc.right = node.x;
      }
      if (node.x < acc.left) {
        acc.left = node.x;
      }
      if (node.y > acc.bottom) {
        acc.bottom = node.y;
      }
      if (node.y < acc.top) {
        acc.top = node.y;
      }
      return acc;
    },
    { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity }
  );

  const y = bounds.top + (bounds.bottom - bounds.top) / 2;
  const x = bounds.left + (bounds.right - bounds.left) / 2;

  return {
    ...bounds,
    center: {
      x,
      y,
    },
  };
}
