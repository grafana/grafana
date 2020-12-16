import React, { useState, MouseEvent } from 'react';
import { getRatios, Stats } from './statsUtils';
import { NodeDatum } from './types';

const nodeR = 40;

export function Node(props: {
  node: NodeDatum;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  onClick: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
}) {
  const { node, onMouseEnter, onMouseLeave, onClick } = props;
  const [hovering, setHovering] = useState(false);
  if (!(node.x !== undefined && node.y !== undefined)) {
    return null;
  }

  return (
    <g
      onMouseEnter={() => {
        setHovering(true);
        onMouseEnter(node.id);
      }}
      onMouseLeave={() => {
        setHovering(false);
        onMouseLeave(node.id);
      }}
      style={{ cursor: 'pointer', fontSize: 10 }}
      onClick={event => {
        onClick(event, node);
      }}
    >
      <ResponseTypeCircle node={node} />
      <circle fill={'#fff'} r={nodeR - 2} cx={node.x} cy={node.y} />
      <circle
        style={{ display: hovering ? 'initial' : 'none', opacity: 0.5 }}
        fill={'transparent'}
        stroke={'rgb(57, 131, 213)'}
        r={nodeR - 3}
        cx={node.x}
        cy={node.y}
        strokeWidth={2}
      />
      <g>
        <text x={node.x} y={node.y - 5} textAnchor={'middle'}>
          avg. {node.stats?.avgResponseTime.toFixed(2)}ms
        </text>
        <text x={node.x} y={node.y + 10} textAnchor={'middle'}>
          {node.stats?.tracesPerMinute === undefined
            ? node.stats?.tracesCount + ' Request' + (node.stats!.tracesCount > 1 ? 's' : '')
            : node.stats?.tracesPerMinute.toFixed(2) + ' t/min'}
        </text>
      </g>
      <g>
        <text x={node.x} y={node.y + nodeR + 15} textAnchor={'middle'}>
          {node.name}
        </text>
        <text x={node.x} y={node.y + nodeR + 30} textAnchor={'middle'}>
          {node.type}
        </text>
      </g>
    </g>
  );
}

function ResponseTypeCircle(props: { node: NodeDatum }) {
  const { node } = props;
  const { nonZero, fullStat } = getRatios(node.stats!);
  if (fullStat) {
    // Doing arc with path does not work well so it's better to just do a circle in that case
    return (
      <circle fill="none" stroke={colors[fullStat as keyof Stats]} strokeWidth={2} r={nodeR} cx={node.x} cy={node.y} />
    );
  }

  const { elements } = nonZero.reduce(
    (acc, k) => {
      const percent = node.stats![k as keyof typeof node.stats];
      const el = (
        <ArcSection
          r={nodeR}
          x={node.x!}
          y={node.y!}
          startPercent={acc.percent}
          percent={percent}
          color={colors[k as keyof Stats]!}
          strokeWidth={(k as keyof Stats) === 'success' ? 2 : 4}
        />
      );
      acc.elements.push(el);
      acc.percent = acc.percent + percent;
      return acc;
    },
    { elements: [] as React.ReactNode[], percent: 0 }
  );

  return <>{elements}</>;
}

const colors: Partial<{ [key in keyof Stats]: string }> = {
  success: 'rgb(80, 171, 113)',
  errors: 'rgb(255, 196, 110)',
  faults: 'rgb(233, 84, 84)',
  throttled: 'purple',
};

function ArcSection({
  r,
  x,
  y,
  startPercent,
  percent,
  color,
  strokeWidth = 2,
}: {
  r: number;
  x: number;
  y: number;
  startPercent: number;
  percent: number;
  color: string;
  strokeWidth?: number;
}) {
  const endPercent = startPercent + percent;
  const startXPos = x + Math.sin(2 * Math.PI * startPercent) * r;
  const startYPos = y - Math.cos(2 * Math.PI * startPercent) * r;
  const endXPos = x + Math.sin(2 * Math.PI * endPercent) * r;
  const endYPos = y - Math.cos(2 * Math.PI * endPercent) * r;
  const largeArc = percent > 0.5 ? '1' : '0';
  return (
    <path
      fill="none"
      d={`M ${startXPos} ${startYPos} A ${r} ${r} 0 ${largeArc} 1 ${endXPos} ${endYPos}`}
      stroke={color}
      strokeWidth={strokeWidth}
    />
  );
}
