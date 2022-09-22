import { fromPairs, uniq } from 'lodash';
import { useMemo } from 'react';

import { Config } from './layout';
import { EdgeDatumLayout, NodeDatum, NodesMarker } from './types';

type NodesMap = Record<string, NodeDatum>;
type EdgesMap = Record<string, EdgeDatumLayout[]>;

/**
 * Limits the number of nodes by going from the roots breadth first until we have desired number of nodes.
 */
export function useNodeLimit(
  nodes: NodeDatum[],
  edges: EdgeDatumLayout[],
  limit: number,
  config: Config,
  rootId?: string
): { nodes: NodeDatum[]; edges: EdgeDatumLayout[]; markers?: NodesMarker[] } {
  // This is pretty expensive also this happens once in the layout code when initializing position but it's a bit
  // tricky to do it only once and reuse the results because layout directly modifies the nodes.
  const [edgesMap, nodesMap] = useMemo(() => {
    // Make sure we don't compute this until we have all the data.
    if (!(nodes.length && edges.length)) {
      return [{}, {}];
    }

    const edgesMap = edges.reduce<EdgesMap>((acc, e) => {
      acc[e.source.id] = [...(acc[e.source.id] ?? []), e];
      acc[e.target.id] = [...(acc[e.target.id] ?? []), e];
      return acc;
    }, {});

    const nodesMap = nodes.reduce<NodesMap>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
    return [edgesMap, nodesMap];
  }, [edges, nodes]);

  return useMemo(() => {
    if (nodes.length <= limit) {
      return { nodes, edges };
    }

    if (config.gridLayout) {
      return limitGridLayout(nodes, limit, rootId);
    }

    return limitGraphLayout(nodes, edges, nodesMap, edgesMap, limit, rootId);
  }, [edges, edgesMap, limit, nodes, nodesMap, rootId, config.gridLayout]);
}

export function limitGraphLayout(
  nodes: NodeDatum[],
  edges: EdgeDatumLayout[],
  nodesMap: NodesMap,
  edgesMap: EdgesMap,
  limit: number,
  rootId?: string
) {
  let roots;
  if (rootId) {
    roots = [nodesMap[rootId]];
  } else {
    roots = nodes.filter((n) => n.incoming === 0);
    // TODO: same code as layout
    if (!roots.length) {
      roots = [nodes[0]];
    }
  }

  const { visibleNodes, markers } = collectVisibleNodes(limit, roots, nodesMap, edgesMap);

  const markersWithStats = collectMarkerStats(markers, visibleNodes, nodesMap, edgesMap);
  const markersMap = fromPairs(markersWithStats.map((m) => [m.node.id, m]));

  for (const marker of markersWithStats) {
    if (marker.count === 1) {
      delete markersMap[marker.node.id];
      visibleNodes[marker.node.id] = marker.node;
    }
  }

  // Show all edges between visible nodes or placeholder markers
  const visibleEdges = edges.filter(
    (e) =>
      (visibleNodes[e.source.id] || markersMap[e.source.id]) && (visibleNodes[e.target.id] || markersMap[e.target.id])
  );

  return {
    nodes: Object.values(visibleNodes),
    edges: visibleEdges,
    markers: Object.values(markersMap),
  };
}

export function limitGridLayout(nodes: NodeDatum[], limit: number, rootId?: string) {
  let start = 0;
  let stop = limit;
  let markers: NodesMarker[] = [];

  if (rootId) {
    const index = nodes.findIndex((node) => node.id === rootId);
    const prevLimit = Math.floor(limit / 2);
    let afterLimit = prevLimit;
    start = index - prevLimit;
    if (start < 0) {
      afterLimit += Math.abs(start);
      start = 0;
    }
    stop = index + afterLimit + 1;

    if (stop > nodes.length) {
      if (start > 0) {
        start = Math.max(0, start - (stop - nodes.length));
      }
      stop = nodes.length;
    }

    if (start > 1) {
      markers.push({ node: nodes[start - 1], count: start });
    }

    if (nodes.length - stop > 1) {
      markers.push({ node: nodes[stop], count: nodes.length - stop });
    }
  } else {
    if (nodes.length - limit > 1) {
      markers = [{ node: nodes[limit], count: nodes.length - limit }];
    }
  }

  return {
    nodes: nodes.slice(start, stop),
    edges: [],
    markers,
  };
}

/**
 * Breath first traverse of the graph collecting all the nodes until we reach the limit. It also returns markers which
 * are nodes on the edges which did not make it into the limit but can be used as clickable markers for manually
 * expanding the graph.
 * @param limit
 * @param roots - Nodes where to start the traversal. In case of exploration this can be any node that user clicked on.
 * @param nodesMap - Node id to node
 * @param edgesMap - This is a map of node id to a list of edges (both ingoing and outgoing)
 */
function collectVisibleNodes(
  limit: number,
  roots: NodeDatum[],
  nodesMap: Record<string, NodeDatum>,
  edgesMap: Record<string, EdgeDatumLayout[]>
): { visibleNodes: Record<string, NodeDatum>; markers: NodeDatum[] } {
  const visibleNodes: Record<string, NodeDatum> = {};
  let stack = [...roots];

  while (Object.keys(visibleNodes).length < limit && stack.length > 0) {
    let current = stack.shift()!;

    // We are already showing this node. This can happen because graphs can be cyclic
    if (visibleNodes[current!.id]) {
      continue;
    }

    // Show this node
    visibleNodes[current.id] = current;
    const edges = edgesMap[current.id] || [];

    // Add any nodes that are connected to it on top of the stack to be considered in the next pass
    const connectedNodes = edges.map((e) => {
      // We don't care about direction here. Should not make much difference but argument could be made that with
      // directed graphs it should walk the graph directionally. Problem is when we focus on a node in the middle of
      // graph (not going from the "natural" root) we also want to show what was "before".
      const id = e.source.id === current.id ? e.target.id : e.source.id;
      return nodesMap[id];
    });
    stack = stack.concat(connectedNodes);
  }

  // Right now our stack contains all the nodes which are directly connected to the graph but did not make the cut.
  // Some of them though can be nodes we already are showing so we have to filter them and then use them as markers.
  const markers = uniq(stack.filter((n) => !visibleNodes[n.id]));

  return { visibleNodes, markers };
}

function collectMarkerStats(
  markers: NodeDatum[],
  visibleNodes: Record<string, NodeDatum>,
  nodesMap: Record<string, NodeDatum>,
  edgesMap: Record<string, EdgeDatumLayout[]>
): NodesMarker[] {
  return markers.map((marker) => {
    const nodesToCount: Record<string, NodeDatum> = {};
    let count = 0;
    let stack = [marker];
    while (stack.length > 0 && count <= 101) {
      let current = stack.shift()!;

      // We are showing this node so not going to count it as hidden.
      if (visibleNodes[current.id] || nodesToCount[current.id]) {
        continue;
      }

      if (!nodesToCount[current.id]) {
        count++;
      }
      nodesToCount[current.id] = current;

      const edges = edgesMap[current.id] || [];

      const connectedNodes = edges.map((e) => {
        const id = e.source.id === current.id ? e.target.id : e.source.id;
        return nodesMap[id];
      });
      stack = stack.concat(connectedNodes);
    }

    return {
      node: marker,
      count: count,
    };
  });
}
