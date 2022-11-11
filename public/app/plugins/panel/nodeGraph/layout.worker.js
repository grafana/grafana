import { forceSimulation, forceLink, forceCollide, forceX } from 'd3-force';

addEventListener('message', (event) => {
  const { nodes, edges, config } = event.data;
  layout(nodes, edges, config);
  postMessage({ nodes, edges });
});

/**
 * Use d3 force layout to lay the nodes in a sensible way. This function modifies the nodes adding the x,y positions
 * and also fills in node references in edges instead of node ids.
 */
export function layout(nodes, edges, config) {
  // Start with some hardcoded positions so it starts laid out from left to right
  let { roots, secondLevelRoots } = initializePositions(nodes, edges);

  // There always seems to be one or more root nodes each with single edge and we want to have them static on the
  // left neatly in something like grid layout
  [...roots, ...secondLevelRoots].forEach((n, index) => {
    n.fx = n.x;
  });

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink(edges)
        .id((d) => d.id)
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
  centerNodes(nodes);
}

/**
 * This initializes positions of the graph by going from the root to its children and laying it out in a grid from left
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
function initializePositions(nodes, edges) {
  // To prevent going in cycles
  const alreadyPositioned = {};

  const nodesMap = nodes.reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});
  const edgesMap = edges.reduce((acc, edge) => {
    const sourceId = edge.source;
    acc[sourceId] = [...(acc[sourceId] || []), edge];
    return acc;
  }, {});

  let roots = nodes.filter((n) => n.incoming === 0);

  // For things like service maps we assume there is some root (client) node but if there is none then selecting
  // any node as a starting point should work the same.
  if (!roots.length) {
    roots = [nodes[0]];
  }

  let secondLevelRoots = roots.reduce((acc, r) => {
    acc.push(...(edgesMap[r.id] ? edgesMap[r.id].map((e) => nodesMap[e.target]) : []));
    return acc;
  }, []);

  const rootYSpacing = 300;
  const nodeYSpacing = 200;
  const nodeXSpacing = 200;

  let rootY = 0;
  for (const root of roots) {
    let graphLevel = [root];
    let x = 0;
    while (graphLevel.length > 0) {
      const nextGraphLevel = [];
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
          nextGraphLevel.push(...edgesMap[node.id].map((edge) => nodesMap[edge.target]));
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
