import { useMemo } from 'react';
import { EdgeDatum, NodeDatum } from './types';

/**
 * Limits the number of nodes by going from the roots breadth first until we have desired number of nodes.
 * TODO: there is some possible perf gains as some of the processing is the same as in layout and so we do double
 *  the work.
 */
export function useNodeLimit(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  limit: number
): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  return useMemo(() => {
    if (nodes.length <= limit) {
      return { nodes, edges };
    }

    const edgesMap = edges.reduce<{ [id: string]: EdgeDatum[] }>((acc, e) => {
      const sourceId = e.source as string;
      return {
        ...acc,
        [sourceId]: [...(acc[sourceId] || []), e],
      };
    }, {});

    const nodesMap = nodes.reduce((acc, node) => ({ ...acc, [node.id]: node }), {} as Record<string, NodeDatum>);

    let roots = nodes.filter((n) => n.incoming === 0);
    const newNodes: Record<string, NodeDatum> = {};
    const stack = [...roots];

    while (Object.keys(newNodes).length < limit && stack.length > 0) {
      let current = stack.shift()!;
      if (newNodes[current!.id]) {
        continue;
      }

      newNodes[current.id] = current;
      const edges = edgesMap[current.id] || [];
      for (const edge of edges) {
        stack.push(nodesMap[edge.target as string]);
      }
    }

    const newEdges = edges.filter((e) => newNodes[e.source as string] && newNodes[e.target as string]);

    return { nodes: Object.values(newNodes), edges: newEdges };
  }, [edges, nodes]);
}
