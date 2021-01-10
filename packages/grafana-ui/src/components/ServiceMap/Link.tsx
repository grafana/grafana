import React, { useState, MouseEvent } from 'react';
import { LinkDatum, NodeDatum } from './types';

interface Props {
  link: LinkDatum;
  showStats: boolean;
  onClick: (event: MouseEvent<SVGElement>, link: LinkDatum) => void;
}
export function Link(props: Props) {
  const { link, showStats, onClick } = props;
  const { source, target } = link as { source: NodeDatum; target: NodeDatum };
  const [hovering, setHovering] = useState(false);

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

  const middle = {
    x: line.x1 + (line.x2 - line.x1) / 2,
    y: line.y1 + (line.y2 - line.y1) / 2,
  };

  return (
    <g onClick={event => onClick(event, link)} style={{ cursor: 'pointer' }}>
      <line
        strokeWidth={hovering || showStats ? 2 : 1}
        stroke={'#999'}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        markerEnd="url(#triangle)"
      />
      <g style={{ display: showStats || hovering ? 'initial' : 'none', fontSize: 8 }}>
        <rect x={middle.x - 40} y={middle.y - 15} width="80" height="30" rx="5" fill={'rgba(0, 0, 0, 0.7)'} />
        <text x={middle.x} y={middle.y - 5} textAnchor={'middle'} fill={'white'}>
          {link.mainStat}
        </text>
        <text x={middle.x} y={middle.y + 10} textAnchor={'middle'} fill={'white'}>
          {link.secondaryStat}
        </text>
      </g>
      <line
        stroke={'transparent'}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        strokeWidth={20}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      />
    </g>
  );
}

type Line = { x1: number; y1: number; x2: number; y2: number };

/**
 * Makes line shorter while keeping the middle in he same place.
 */
function shortenLine(line: Line, length: number): Line {
  const vx = line.x2 - line.x1;
  const vy = line.y2 - line.y1;
  const mag = Math.sqrt(vx * vx + vy * vy);
  const ratio = Math.max((mag - length) / mag, 0);
  const vx2 = vx * ratio;
  const vy2 = vy * ratio;
  const xDiff = vx - vx2;
  const yDiff = vy - vy2;
  const newx1 = line.x1 + xDiff / 2;
  const newy1 = line.y1 + yDiff / 2;
  return {
    x1: newx1,
    y1: newy1,
    x2: newx1 + vx2,
    y2: newy1 + vy2,
  };
}
