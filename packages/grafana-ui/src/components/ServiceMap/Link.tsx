import React, { useState, MouseEvent } from 'react';
import { capitalize } from 'lodash';
import { LinkDatum, NodeDatum } from './types';
import { getRatios } from './statsUtils';

interface Props {
  link: LinkDatum;
  showStats: boolean;
  onClick: (event: MouseEvent<SVGElement>, link: LinkDatum) => void;
}
export function Link(props: Props) {
  const { link, showStats, onClick } = props;
  const { source, target } = link as { source: NodeDatum; target: NodeDatum };
  const [hovering, setHovering] = useState(false);

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

  const { nonZero, fullStat } = getRatios(link.stats!);
  const firstNonSuccess = nonZero.filter(k => k !== 'success')[0];

  const statsText = fullStat
    ? statLine(fullStat, link.stats![fullStat])
    : statLine(firstNonSuccess, link.stats![firstNonSuccess]);

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
      <g style={{ display: showStats || hovering ? 'initial' : 'none' }}>
        <rect x={middle.x - 50} y={middle.y - 15} width="100" height="40" rx="5" fill={'white'} />
        <text x={middle.x} y={middle.y - 5} textAnchor={'middle'}>
          {statsText}
        </text>
        <text x={middle.x} y={middle.y + 10} textAnchor={'middle'}>
          {link.stats?.tracesPerMinute.toFixed(2)} t/min
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

function statLine(stat: string, value: number) {
  return `${capitalize(stat)} ${(value * 100).toFixed(2)}%`;
}

type Line = { x1: number; y1: number; x2: number; y2: number };
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
