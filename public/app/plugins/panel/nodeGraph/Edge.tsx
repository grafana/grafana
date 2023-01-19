import React, { MouseEvent, memo } from 'react';

import { EdgeDatum, NodeDatum } from './types';
import { shortenLine } from './utils';

interface Props {
  edge: EdgeDatum;
  hovering: boolean;
  onClick: (event: MouseEvent<SVGElement>, link: EdgeDatum) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}
export const Edge = memo(function Edge(props: Props) {
  const { edge, onClick, onMouseEnter, onMouseLeave, hovering } = props;
  // Not great typing but after we do layout these properties are full objects not just references
  const { source, target } = edge as { source: NodeDatum; target: NodeDatum };

  // As the nodes have some radius we want edges to end outside of the node circle.
  const line = shortenLine(
    {
      x1: source.x!,
      y1: source.y!,
      x2: target.x!,
      y2: target.y!,
    },
    90
  );

  return (
    <g
      onClick={(event) => onClick(event, edge)}
      style={{ cursor: 'pointer' }}
      aria-label={`Edge from: ${source.id} to: ${target.id}`}
    >
      <line
        strokeWidth={hovering ? 2 : 1}
        stroke={'#999'}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        markerEnd="url(#triangle)"
      />
      <line
        stroke={'transparent'}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        strokeWidth={20}
        onMouseEnter={() => {
          onMouseEnter(edge.id);
        }}
        onMouseLeave={() => {
          onMouseLeave(edge.id);
        }}
      />
    </g>
  );
});
