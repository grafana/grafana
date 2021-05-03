import { useEffect, useMemo, useState } from 'react';
import { EdgeDatum, EdgeDatumLayout, NodeDatum } from './types';
import { Field } from '@grafana/data';
import { useNodeLimit } from './useNodeLimit';
import useMountedState from 'react-use/lib/useMountedState';
import { graphBounds } from './utils';
// @ts-ignore
import LayoutWorker from 'worker-loader!./layout.worker.js';

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

  const isMounted = useMountedState();

  // Also we compute both layouts here. Grid layout should not add much time and we can more easily just cache both
  // so this should happen only once for a given response data.
  //
  // Also important note is that right now this works on all the nodes even if they are not visible. This means that
  // the node position is stable even when expanding different parts of graph. It seams like a reasonable thing but
  // implications are that limiting visible nodes count does not have a positive perf effect, graphs with high node
  // count can seem weird (very sparse or spread out) when we show only some nodes but layout is done for thousands of
  // nodes but we also do this only once in the graph lifecycle. We could re-layout this on visible nodes change but
  // this ma need smaller visible node limit to keep the perf and also would be very weird without any animation to
  // understand what is happening.
  useEffect(() => {
    if (rawNodes.length === 0) {
      return;
    }

    // Give time to render loading state.
    setTimeout(() => {
      if (!isMounted) {
        return;
      }

      // d3 just modifies the nodes directly, so lets make sure we don't leak that outside
      let rawNodesCopy = rawNodes.map((n) => ({ ...n }));
      let rawEdgesCopy = rawEdges.map((e) => ({ ...e }));

      defaultLayout(rawNodesCopy, rawEdgesCopy, ({ nodes, edges }) => {
        setNodesGraph(nodes);
        setEdgesGraph(edges as EdgeDatumLayout[]);
      });

      rawNodesCopy = rawNodes.map((n) => ({ ...n }));
      rawEdgesCopy = rawEdges.map((e) => ({ ...e }));
      gridLayout(rawNodesCopy, config.sort);

      setNodesGrid(rawNodesCopy);
      setEdgesGrid(rawEdgesCopy as EdgeDatumLayout[]);
    }, 50);
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
  };
}

/**
 * Use d3 force layout to lay the nodes in a sensible way. This function modifies the nodes adding the x,y positions
 * and also fills in node references in edges instead of node ids.
 */
function defaultLayout(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  done: (data: { nodes: NodeDatum[]; edges: EdgeDatum[] }) => void
) {
  console.log('starting worker');
  // const worker = new Worker('./layout.worker.js', { type: 'module' });
  const worker = new LayoutWorker();
  worker.onmessage = (event: MessageEvent) => {
    console.log('on data');
    done(event.data);
  };

  console.log('post message');
  worker.postMessage({ nodes, edges, config: defaultConfig });
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
