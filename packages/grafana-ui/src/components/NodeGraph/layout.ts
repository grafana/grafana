import { useEffect, useState } from 'react';
import { forceSimulation, forceLink, forceCollide, forceX } from 'd3-force';
import { EdgeDatum, NodeDatum } from './types';

export interface Config {
  linkDistance: number;
  linkStrength: number;
  forceX: number;
  forceXStrength: number;
  forceCollide: number;
  tick: number;
}

export const defaultConfig: Config = {
  linkDistance: 150,
  linkStrength: 0.5,
  forceX: 2000,
  forceXStrength: 0.02,
  forceCollide: 100,
  tick: 300,
};

/**
 * This will return copy of the nods and edges with x,y positions filled in. Also the layout changes source/target props
 * in edges from string ids to actual nodes.
 * TODO: the typing could probably be done better so it's clear that props are filled in after the layout
 */
export function useLayout(
  rawNodes: NodeDatum[],
  rawEdges: EdgeDatum[],
  config: Config = defaultConfig
): { bounds: Bounds; nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [edges, setEdges] = useState<EdgeDatum[]>([]);

  // TODO the use effect is probably not needed here right now, but may make sense later if we decide to move the layout
  // to webworker or just postpone until other things are rendered. Also right now it memoizes this for us.
  useEffect(() => {
    if (rawNodes.length === 0) {
      return;
    }

    // d3 just modifies the nodes directly, so lets make sure we don't leak that outside
    const rawNodesCopy = rawNodes.map((n) => ({ ...n }));
    const rawEdgesCopy = rawEdges.map((e) => ({ ...e }));

    // Start withs some hardcoded positions so it starts laid out from left to right
    let { roots, secondLevelRoots } = initializePositions(rawNodesCopy, rawEdgesCopy);

    // There always seems to be one or more root nodes each with single edge and we want to have them static on the
    // left neatly in something like grid layout
    [...roots, ...secondLevelRoots].forEach((n, index) => {
      n.fx = n.x;
    });

    const simulation = forceSimulation(rawNodesCopy)
      .force(
        'link',
        forceLink(rawEdgesCopy)
          .id((d: any) => d.id)
          .distance(config.linkDistance)
          .strength(config.linkStrength)
      )
      // to keep the left to right layout we add force that pulls all nodes to right but because roots are fixed it will
      // apply only to non root nodes
      .force('x', forceX(config.forceX).strength(config.forceXStrength))
      // Make sure nodes don't overlap
      .force('collide', forceCollide(config.forceCollide));

    // 300 ticks for the simulation are recommended but less would probably work too, most movement is done in first
    // few iterations and then all the forces gets smaller https://github.com/d3/d3-force#simulation_alphaDecay
    simulation.tick(config.tick);
    simulation.stop();

    // We do centering here instead of using centering force to keep this more stable
    centerNodes(rawNodesCopy);
    setNodes(rawNodesCopy);
    setEdges(rawEdgesCopy);
  }, [config, rawNodes, rawEdges]);

  return {
    nodes,
    edges,
    bounds: graphBounds(nodes) /* momeoize? loops over all nodes every time and we do it 2 times */,
  };
}

/**
 * This initializes positions of the graph by going from the root to it's children and laying it out in a grid from left
 * to right. This works only so, so because service map graphs can have cycles and children levels are not ordered in a
 * way to minimize the edge lengths. Nevertheless this seems to make the graph easier to nudge with the forces later on
 * than with the d3 default initial positioning. Also we can fix the root positions later on for a bit more neat
 * organisation.
 *
 * This function directly modifies the nodes given and only returns references to root nodes so they do not have to be
 * found again later on.
 *
 * How the spacing could look like approximately:
 * 0 - 0 - 0 - 0
 *  \- 0 - 0   |
 *      \- 0 -/
 * 0 - 0 -/
 */
function initializePositions(
  nodes: NodeDatum[],
  edges: EdgeDatum[]
): { roots: NodeDatum[]; secondLevelRoots: NodeDatum[] } {
  // To prevent going in cycles
  const alreadyPositioned: { [id: string]: boolean } = {};

  const nodesMap = nodes.reduce((acc, node) => ({ ...acc, [node.id]: node }), {} as Record<string, NodeDatum>);
  const edgesMap = edges.reduce((acc, edge) => {
    const sourceId = edge.source as number;
    return {
      ...acc,
      [sourceId]: [...(acc[sourceId] || []), edge],
    };
  }, {} as Record<string, EdgeDatum[]>);

  let roots = nodes.filter((n) => n.incoming === 0);

  let secondLevelRoots = roots.reduce<NodeDatum[]>(
    (acc, r) => [...acc, ...(edgesMap[r.id] ? edgesMap[r.id].map((e) => nodesMap[e.target as number]) : [])],
    []
  );

  const rootYSpacing = 300;
  const nodeYSpacing = 200;
  const nodeXSpacing = 200;

  let rootY = 0;
  for (const root of roots) {
    let graphLevel = [root];
    let x = 0;
    while (graphLevel.length > 0) {
      const nextGraphLevel: NodeDatum[] = [];
      let y = rootY;
      for (const node of graphLevel) {
        if (alreadyPositioned[node.id]) {
          continue;
        }
        // Initialize positions based on the spacing in the grid
        node.x = x;
        node.y = y;
        alreadyPositioned[node.id] = true;

        // Move to next Y position for next node
        y += nodeYSpacing;
        if (edgesMap[node.id]) {
          nextGraphLevel.push(...edgesMap[node.id].map((edge) => nodesMap[edge.target as number]));
        }
      }

      graphLevel = nextGraphLevel;
      // Move to next X position for next level
      x += nodeXSpacing;
      // Reset Y back to baseline for this root
      y = rootY;
    }
    rootY += rootYSpacing;
  }
  return { roots, secondLevelRoots };
}

/**
 * Makes sure that the center of the graph based on it's bound is in 0, 0 coordinates.
 * Modifies the nodes directly.
 */
function centerNodes(nodes: NodeDatum[]) {
  const bounds = graphBounds(nodes);
  const middleY = bounds.top + (bounds.bottom - bounds.top) / 2;
  const middleX = bounds.left + (bounds.right - bounds.left) / 2;

  for (let node of nodes) {
    node.x = node.x! - middleX;
    node.y = node.y! - middleY;
  }
}

export interface Bounds {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Get bounds of the graph meaning the extent of the nodes in all directions.
 */
function graphBounds(nodes: NodeDatum[]): Bounds {
  if (nodes.length === 0) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  return nodes.reduce(
    (acc, node) => {
      if (node.x! > acc.right) {
        acc.right = node.x!;
      }
      if (node.x! < acc.left) {
        acc.left = node.x!;
      }
      if (node.y! > acc.bottom) {
        acc.bottom = node.y!;
      }
      if (node.y! < acc.top) {
        acc.top = node.y!;
      }
      return acc;
    },
    { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity }
  );
}
