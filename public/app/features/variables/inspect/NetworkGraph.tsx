import { useCallback, useEffect, useRef } from 'react';

import { GraphEdge, GraphNode } from './utils';

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

export const NetworkGraph = ({ nodes, edges, direction, width, height, onDoubleClick }: Props) => {
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
    const createNetwork = async () => {
      // @ts-ignore no types yet for visjs-network
      const visJs = await import(/* webpackChunkName: "visjs-network" */ 'visjs-network');
      const data = {
        nodes: toVisNetworkNodes(visJs, nodes),
        edges: toVisNetworkEdges(visJs, edges),
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

      network.current = new visJs.Network(ref.current, data, options);
      network.current?.on('doubleClick', onNodeDoubleClick);
    };

    createNetwork();

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

function toVisNetworkNodes(visJs: any, nodes: GraphNode[]): any[] {
  const nodesWithStyle = nodes.map((node) => ({
    ...node,
    shape: 'box',
  }));
  return new visJs.DataSet(nodesWithStyle);
}

function toVisNetworkEdges(visJs: any, edges: GraphEdge[]): any[] {
  const edgesWithStyle = edges.map((edge) => ({ ...edge, arrows: 'to', dashes: true }));
  return new visJs.DataSet(edgesWithStyle);
}
