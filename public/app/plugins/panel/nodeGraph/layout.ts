import { fromPairs } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUnmount } from 'react-use';
import useMountedState from 'react-use/lib/useMountedState';

import { Field } from '@grafana/data';

import { createWorker, createMsaglWorker } from './createLayoutWorker';
import { LayoutAlgorithm } from './panelcfg.gen';
import { EdgeDatum, EdgeDatumLayout, NodeDatum } from './types';
import { useNodeLimit } from './useNodeLimit';
import { graphBounds } from './utils';

export interface Config {
  layoutAlgorithm: LayoutAlgorithm;
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
  layoutAlgorithm: LayoutAlgorithm.Layered,
  linkDistance: 150,
  linkStrength: 0.5,
  forceX: 2000,
  forceXStrength: 0.02,
  forceCollide: 100,
  tick: 300,
  gridLayout: false,
};

export interface LayoutCache {
  [LayoutAlgorithm.Force]?: { nodes: NodeDatum[]; edges: EdgeDatumLayout[] };
  [LayoutAlgorithm.Layered]?: { nodes: NodeDatum[]; edges: EdgeDatumLayout[] };
}

/**
 * This will return copy of the nods and edges with x,y positions filled in. Also the layout changes source/target props
 * in edges from string ids to actual nodes.
 */
export function useLayout(
  rawNodes: NodeDatum[],
  rawEdges: EdgeDatum[],
  config: Config = defaultConfig,
  nodeCountLimit: number,
  width: number,
  rootNodeId?: string,
  hasFixedPositions?: boolean,
  layoutCache?: LayoutCache
) {
  const [nodesGraph, setNodesGraph] = useState<NodeDatum[]>([]);
  const [edgesGraph, setEdgesGraph] = useState<EdgeDatumLayout[]>([]);

  const [loading, setLoading] = useState(false);

  // Store current data signature to detect changes
  const dataSignatureRef = useRef<string>('');
  const currentSignature = createDataSignature(rawNodes, rawEdges);

  const isMounted = useMountedState();
  const layoutWorkerCancelRef = useRef<(() => void) | undefined>();

  useUnmount(() => {
    if (layoutWorkerCancelRef.current) {
      layoutWorkerCancelRef.current();
    }
  });

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
      setNodesGraph([]);
      setEdgesGraph([]);
      setLoading(false);
      return;
    }

    if (hasFixedPositions) {
      setNodesGraph(rawNodes);
      // The layout function turns source and target fields from string to NodeDatum, so we do that here as well.
      const nodesMap = fromPairs(rawNodes.map((node) => [node.id, node]));
      setEdgesGraph(
        rawEdges.map(
          (e): EdgeDatumLayout => ({
            ...e,
            source: nodesMap[e.source],
            target: nodesMap[e.target],
          })
        )
      );
      setLoading(false);
      return;
    }

    // Layered layout is better but also more expensive.
    let layoutType: 'force' | 'layered' = 'force';
    let algorithmType = LayoutAlgorithm.Force;

    if (config.layoutAlgorithm === LayoutAlgorithm.Layered) {
      layoutType = 'layered';
      algorithmType = LayoutAlgorithm.Layered;
    }

    // Check if data has changed since last render
    const hasDataChanged = dataSignatureRef.current !== currentSignature;

    // Clear cache if data has changed
    if (hasDataChanged) {
      dataSignatureRef.current = currentSignature;

      if (layoutCache) {
        delete layoutCache[LayoutAlgorithm.Force];
        delete layoutCache[LayoutAlgorithm.Layered];
      }
    }

    // Check if we have a cached layout for this algorithm
    if (layoutCache && layoutCache[algorithmType]) {
      setNodesGraph(layoutCache[algorithmType]?.nodes ?? []);
      setEdgesGraph(layoutCache[algorithmType]?.edges ?? []);
      setLoading(false);
      return;
    }

    setLoading(true);

    const cancel = layout(rawNodes, rawEdges, layoutType, ({ nodes, edges }) => {
      if (isMounted()) {
        setNodesGraph(nodes);
        setEdgesGraph(edges);
        setLoading(false);

        // Cache the calculated layout
        if (layoutCache) {
          layoutCache[algorithmType] = { nodes, edges };
        }
      }
    });
    layoutWorkerCancelRef.current = cancel;
    return cancel;
  }, [hasFixedPositions, rawNodes, rawEdges, isMounted, config.layoutAlgorithm, layoutCache, currentSignature]);

  // Compute grid separately as it is sync and do not need to be inside effect. Also it is dependant on width while
  // default layout does not care and we don't want to recalculate that on panel resize.
  const [nodesGrid, edgesGrid] = useMemo(() => {
    if (rawNodes.length === 0) {
      return [[], []];
    }

    const rawNodesCopy = rawNodes.map((n) => ({ ...n }));
    const rawEdgesCopy = rawEdges.map((e) => ({ ...e }));
    gridLayout(rawNodesCopy, width, config.sort);

    return [rawNodesCopy, rawEdgesCopy as EdgeDatumLayout[]];
  }, [config.sort, rawNodes, rawEdges, width]);

  // Limit the nodes so we don't show all for performance reasons. Here we don't compute both at the same time so
  // changing the layout can trash internal memoization at the moment.
  const {
    nodes: nodesWithLimit,
    edges: edgesWithLimit,
    markers,
  } = useNodeLimit(
    config.gridLayout ? nodesGrid : nodesGraph,
    config.gridLayout ? edgesGrid : edgesGraph,
    nodeCountLimit,
    config,
    rootNodeId
  );

  // Get bounds based on current limited number of nodes.
  const bounds = useMemo(
    () => graphBounds([...nodesWithLimit, ...(markers || []).map((m) => m.node)]),
    [nodesWithLimit, markers]
  );

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
 * Returns a cancel function to terminate the worker.
 */
function layout(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  engine: 'force' | 'layered',
  done: (data: { nodes: NodeDatum[]; edges: EdgeDatumLayout[] }) => void
) {
  const worker = engine === 'force' ? createWorker() : createMsaglWorker();

  worker.onmessage = (event: MessageEvent<{ nodes: NodeDatum[]; edges: EdgeDatumLayout[] }>) => {
    const nodesMap = fromPairs(nodes.map((node) => [node.id, node]));

    // Add the x,y coordinates from the layout algorithm to the original nodes.
    event.data.nodes = event.data.nodes.map((node) => {
      return {
        ...nodesMap[node.id],
        ...node,
      };
    });

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

  return () => {
    worker.terminate();
  };
}

/**
 * Set the nodes in simple grid layout sorted by some stat.
 */
function gridLayout(
  nodes: NodeDatum[],
  width: number,
  sort?: {
    field: Field;
    ascending: boolean;
  }
) {
  const spacingVertical = 140;
  const spacingHorizontal = 120;
  const padding = spacingHorizontal / 2;
  const perRow = Math.min(Math.floor((width - padding * 2) / spacingVertical), nodes.length);
  const midPoint = Math.floor(((perRow - 1) * spacingHorizontal) / 2);

  if (sort) {
    nodes.sort((node1, node2) => {
      const val1 = sort!.field.values[node1.dataFrameRowIndex];
      const val2 = sort!.field.values[node2.dataFrameRowIndex];

      // Let's pretend we don't care about type of the stats for a while (they can be strings)
      return sort!.ascending ? val1 - val2 : val2 - val1;
    });
  }

  for (const [index, node] of nodes.entries()) {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    node.x = column * spacingHorizontal - midPoint;
    node.y = -60 + row * spacingVertical;
  }
}

function createDataSignature(nodes: NodeDatum[], edges: EdgeDatum[]): string {
  const signature = [`n:${nodes.length}`, `e:${edges.length}`];

  if (nodes.length > 0) {
    const firstNode = nodes[0].id ?? '';
    signature.push(`f:${firstNode}`);

    // Middle node (if there are at least 3 nodes)
    if (nodes.length >= 3) {
      const middleIndex = Math.floor(nodes.length / 2);
      const middleNode = nodes[middleIndex].id ?? '';
      signature.push(`m:${middleNode}`);
    }

    const lastNode = nodes[nodes.length - 1].id ?? '';
    signature.push(`l:${lastNode}`);

    // Add basic connectivity information
    let connectedNodesCount = 0;
    let maxConnections = 0;

    for (const node of nodes) {
      const connections = node.incoming || 0;
      if (connections > 0) {
        connectedNodesCount++;
      }
      maxConnections = Math.max(maxConnections, connections);
    }

    signature.push(`cn:${connectedNodesCount}`);
    signature.push(`mc:${maxConnections}`);
  }

  return signature.join('_');
}
