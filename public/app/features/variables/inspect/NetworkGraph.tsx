import React, { FC, useCallback, useEffect, useRef } from 'react';
// @ts-ignore
import vis from 'visjs-network';
import { GraphEdge, GraphNode, toVisNetworkEdges, toVisNetworkNodes } from './utils';

interface OwnProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  direction?: 'UD' | 'DU' | 'LR' | 'RL';
  onDoubleClick?: (node: string) => void;
  width?: string;
  height?: string;
}

interface ConnectedProps {}

interface DispatchProps {}

export type Props = OwnProps & ConnectedProps & DispatchProps;

export const NetworkGraph: FC<Props> = ({ nodes, edges, direction, width, height, onDoubleClick }) => {
  const network = useRef<any>(null);
  const ref = useRef(null);

  const onNodeDoubleClick = useCallback(
    (params: { nodes: string[] }) => {
      if (onDoubleClick) {
        onDoubleClick(params.nodes[0]);
      }
    },
    [onDoubleClick]
  );

  useEffect(() => {
    const data = {
      nodes: toVisNetworkNodes(nodes),
      edges: toVisNetworkEdges(edges),
    };

    const options = {
      width: '100%',
      height: '100%',
      autoResize: true,
      layout: {
        improvedLayout: true,
        hierarchical: {
          enabled: true,
          direction: direction ?? 'DU',
          sortMethod: 'directed',
        },
      },
      interaction: {
        navigationButtons: true,
        dragNodes: false,
      },
    };

    network.current = new vis.Network(ref.current, data, options);
    network.current?.on('doubleClick', onNodeDoubleClick);

    return () => {
      // unsubscribe event handlers
      if (network.current) {
        network.current.off('doubleClick');
      }
    };
  }, [direction, edges, nodes, onNodeDoubleClick]);

  return (
    <div>
      <div ref={ref} style={{ width: width ?? '100%', height: height ?? '60vh' }} />
    </div>
  );
};
