import React, { MouseEvent } from 'react';
import { LinkDatum, NodeDatum } from './types';
import { shortenLine } from './utils';

interface Props {
  link: LinkDatum;
  hovering: boolean;
  onClick: (event: MouseEvent<SVGElement>, link: LinkDatum) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}
export function Link(props: Props) {
  const { link, onClick, onMouseEnter, onMouseLeave, hovering } = props;
  const { source, target } = link as { source: NodeDatum; target: NodeDatum };

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
    <g onClick={event => onClick(event, link)} style={{ cursor: 'pointer' }}>
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
          onMouseEnter(link.id);
        }}
        onMouseLeave={() => {
          onMouseLeave(link.id);
        }}
      />
    </g>
  );
}
