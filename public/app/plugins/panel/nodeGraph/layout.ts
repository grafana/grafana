import { useEffect, useMemo, useState } from 'react';
import { EdgeDatum, EdgeDatumLayout, NodeDatum } from './types';
import { Field } from '@grafana/data';
import { useNodeLimit } from './useNodeLimit';
import useMountedState from 'react-use/lib/useMountedState';
import { graphBounds } from './utils';
// @ts-ignore
import LayoutWorker from './layout.worker.js';

export interface Config {
  linkDistance: number;
  linkStrength: number;
  forceX: number;
  forceXStrength: number;
  forceCollide: number;
  tick: number;
  gridLayout: boolean;
  sort?: {
    // Either a arc field or stats field
    field: Field;
    ascending: boolean;
  };
}

// Config mainly for the layout but also some other parts like current layout. The layout variables can be changed only
// if you programmatically enable the config editor (for development only) see ViewControls. These could be moved to
// panel configuration at some point (apart from gridLayout as that can be switched be user right now.).
export const defaultConfig: Config = {
  linkDistance: 150,
  linkStrength: 0.5,
  forceX: 2000,
  forceXStrength: 0.02,
  forceCollide: 100,
  tick: 300,
  gridLayout: false,
};

/**
 * This will return copy of the nods and edges with x,y positions filled in. Also the layout changes source/target props
 * in edges from string ids to actual nodes.
 */
export function useLayout(
  rawNodes: NodeDatum[],
  rawEdges: EdgeDatum[],
  config: Config = defaultConfig,
  nodeCountLimit: number,
  rootNodeId?: string
) {
  const [nodesGrid, setNodesGrid] = useState<NodeDatum[]>([]);
  const [edgesGrid, setEdgesGrid] = useState<EdgeDatumLayout[]>([]);

  const [nodesGraph, setNodesGraph] = useState<NodeDatum[]>([]);
  const [edgesGraph, setEdgesGraph] = useState<EdgeDatumLayout[]>([]);

  const [loading, setLoading] = useState(false);

  const isMounted = useMountedState();

  // Also we compute both layouts here. Grid layout should not add much time and we can more easily just cache both
  // so this should happen only once for a given response data.
  //
  // Also important note is that right now this works on all the nodes even if they are not visible. This means that
  // the node position is stable even when expanding different parts of graph. It seems like a reasonable thing but
  // implications are that:
  // - limiting visible nodes count does not have a positive perf effect
  // - graphs with high node count can seem weird (very sparse or spread out) when we show only some nodes but layout
  //   is done for thousands of nodes but we also do this only once in the graph lifecycle.
  // We could re-layout this on visible nodes change but this may need smaller visible node limit to keep the perf
  // (as we would run layout on every click) and also would be very weird without any animation to understand what is
  // happening as already visible nodes would change positions.
  useEffect(() => {
    if (rawNodes.length === 0) {
      return;
    }

    setLoading(true);

    // d3 just modifies the nodes directly, so lets make sure we don't leak that outside
    let rawNodesCopy = rawNodes.map((n) => ({ ...n }));
    let rawEdgesCopy = rawEdges.map((e) => ({ ...e }));

    // This is async but as I wanted to still run the sync grid layout and you cannot return promise from effect having
    // callback seem ok here.
    defaultLayout(rawNodesCopy, rawEdgesCopy, ({ nodes, edges }) => {
      // TODO: it would be better to cancel the worker somehow but probably not super important right now.
      if (isMounted()) {
        setNodesGraph(nodes);
        setEdgesGraph(edges as EdgeDatumLayout[]);
        setLoading(false);
      }
    });

    rawNodesCopy = rawNodes.map((n) => ({ ...n }));
    rawEdgesCopy = rawEdges.map((e) => ({ ...e }));
    gridLayout(rawNodesCopy, config.sort);

    setNodesGrid(rawNodesCopy);
    setEdgesGrid(rawEdgesCopy as EdgeDatumLayout[]);
  }, [config.sort, rawNodes, rawEdges, isMounted]);

  // Limit the nodes so we don't show all for performance reasons. Here we don't compute both at the same time so
  // changing the layout can trash internal memoization at the moment.
  const { nodes: nodesWithLimit, edges: edgesWithLimit, markers } = useNodeLimit(
    config.gridLayout ? nodesGrid : nodesGraph,
    config.gridLayout ? edgesGrid : edgesGraph,
    nodeCountLimit,
    config,
    rootNodeId
  );

  // Get bounds based on current limited number of nodes.
  const bounds = useMemo(() => graphBounds([...nodesWithLimit, ...(markers || []).map((m) => m.node)]), [
    nodesWithLimit,
    markers,
  ]);

  return {
    nodes: nodesWithLimit,
    edges: edgesWithLimit,
    markers,
    bounds,
    hiddenNodesCount: rawNodes.length - nodesWithLimit.length,
    loading,
  };
}

/**
 * Wraps the layout code in a worker as it can take long and we don't want to block the main thread.
 */
function defaultLayout(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  done: (data: { nodes: NodeDatum[]; edges: EdgeDatum[] }) => void
) {
  const worker = new LayoutWorker();
  worker.onmessage = (event: MessageEvent<{ nodes: NodeDatum[]; edges: EdgeDatumLayout[] }>) => {
    for (let i = 0; i < nodes.length; i++) {
      // These stats needs to be Field class but the data is stringified over the worker boundary
      event.data.nodes[i] = {
        ...nodes[i],
        ...event.data.nodes[i],
      };
    }
    done(event.data);
  };

  worker.postMessage({
    nodes: nodes.map((n) => ({
      id: n.id,
      incoming: n.incoming,
    })),
    edges,
    config: defaultConfig,
  });
}

/**
 * Set the nodes in simple grid layout sorted by some stat.
 */
function gridLayout(
  nodes: NodeDatum[],
  sort?: {
    field: Field;
    ascending: boolean;
  }
) {
  const spacingVertical = 140;
  const spacingHorizontal = 120;
  // TODO probably make this based on the width of the screen
  const perRow = 4;

  if (sort) {
    nodes.sort((node1, node2) => {
      const val1 = sort!.field.values.get(node1.dataFrameRowIndex);
      const val2 = sort!.field.values.get(node2.dataFrameRowIndex);

      // Lets pretend we don't care about type for a while
      return sort!.ascending ? val2 - val1 : val1 - val2;
    });
  }

  for (const [index, node] of nodes.entries()) {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    node.x = -180 + column * spacingHorizontal;
    node.y = -60 + row * spacingVertical;
  }
}
