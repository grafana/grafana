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
  const { mappedEdges, DOTToIdMap } = createMappings(nodes, edges);

  const dot = edgesToDOT(mappedEdges);
  const graph = parseDot(dot);
  const geomGraph = new GeomGraph(graph);
  for (const e of graph.deepEdges) {
    new GeomEdge(e);
  }

  for (const n of graph.nodesBreadthFirst) {
    const gn = new GeomNode(n);
    gn.boundaryCurve = CurveFactory.mkCircle(50, new Point(0, 0));
  }
  geomGraph.layoutSettings = new SugiyamaLayoutSettings();
  geomGraph.layoutSettings.layerDirection = LayerDirectionEnum.LR;
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

  // This section checks if there are separate disjointed subgraphs. If so it groups nodes for each and then aligns
  // each subgraph, so it starts on a single vertical line. Otherwise, they are laid out randomly from left to right.
  const subgraphs = [];
  for (const e of edgesMapped) {
    const sourceGraph = subgraphs.find((g) => g.nodes.has(e.source));
    const targetGraph = subgraphs.find((g) => g.nodes.has(e.target));
    if (sourceGraph && targetGraph) {
      // if the node sets are not the same we merge them
      if (sourceGraph !== targetGraph) {
        targetGraph.nodes.forEach(sourceGraph.nodes.add, sourceGraph.nodes);
        subgraphs.splice(subgraphs.indexOf(targetGraph), 1);
        sourceGraph.top = Math.min(sourceGraph.top, targetGraph.top);
        sourceGraph.bottom = Math.max(sourceGraph.bottom, targetGraph.bottom);
        sourceGraph.left = Math.min(sourceGraph.left, targetGraph.left);
        sourceGraph.right = Math.max(sourceGraph.right, targetGraph.right);
      }
      // if the sets are the same nothing to do.
    } else if (sourceGraph) {
      sourceGraph.nodes.add(e.target);
      sourceGraph.top = Math.min(sourceGraph.top, e.target.y);
      sourceGraph.bottom = Math.max(sourceGraph.bottom, e.target.y);
      sourceGraph.left = Math.min(sourceGraph.left, e.target.x);
      sourceGraph.right = Math.max(sourceGraph.right, e.target.x);
    } else if (targetGraph) {
      targetGraph.nodes.add(e.source);
      targetGraph.top = Math.min(targetGraph.top, e.source.y);
      targetGraph.bottom = Math.max(targetGraph.bottom, e.source.y);
      targetGraph.left = Math.min(targetGraph.left, e.source.x);
      targetGraph.right = Math.max(targetGraph.right, e.source.x);
    } else {
      // we don't have these nodes
      subgraphs.push({
        top: Math.min(e.source.y, e.target.y),
        bottom: Math.max(e.source.y, e.target.y),
        left: Math.min(e.source.x, e.target.x),
        right: Math.max(e.source.x, e.target.x),
        nodes: new Set([e.source, e.target]),
      });
    }
  }

  let top = 0;
  let left = 0;
  for (const g of subgraphs) {
    if (top === 0) {
      top = g.bottom + 200;
      left = g.left;
    } else {
      const topDiff = top - g.top;
      const leftDiff = left - g.left;
      for (const n of g.nodes) {
        n.x += leftDiff;
        n.y += topDiff;
      }
      top += g.bottom - g.top + 200;
    }
  }

  const finalNodes = Object.values(nodesMap).map((v) => v.datum);

  centerNodes(finalNodes);
  return [finalNodes, edgesMapped];
}

// We create mapping because the DOT language we use later to create the graph doesn't support arbitrary IDs. So we
// map our IDs to just an index of the node so the IDs are safe for the DOT parser and also create and inverse mapping
// for quick lookup.
function createMappings(nodes, edges) {
  // Edges where the source and target IDs are the indexes we use for layout
  const mappedEdges = [];

  // Key is an ID of the node and value is new ID which is just iteration index
  const idToDOTMap = {};

  // Key is an iteration index and value is actual ID of the node
  const DOTToIdMap = {};

  // Crate the maps both ways
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

  return {
    mappedEdges,
    DOTToIdMap,
  };
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
