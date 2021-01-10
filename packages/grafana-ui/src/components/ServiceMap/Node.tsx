import React, { MouseEvent } from 'react';
import { NodeDatum } from './types';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

const nodeR = 40;

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  mainGroup: css`
    cursor: pointer;
    font-size: 10px;
  `,
}));

export function Node(props: {
  node: NodeDatum;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  onClick: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
  hovering: boolean;
}) {
  const { node, onMouseEnter, onMouseLeave, onClick, hovering } = props;
  const styles = getStyles(useTheme());

  if (!(node.x !== undefined && node.y !== undefined)) {
    return null;
  }

  return (
    <g
      onMouseEnter={() => {
        onMouseEnter(node.id);
      }}
      onMouseLeave={() => {
        onMouseLeave(node.id);
      }}
      className={styles.mainGroup}
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
          {node.mainStat}
        </text>
        <text x={node.x} y={node.y + 10} textAnchor={'middle'}>
          {node.secondaryStat}
        </text>
      </g>
      <g>
        <text x={node.x} y={node.y + nodeR + 15} textAnchor={'middle'}>
          {node.title}
        </text>
        <text x={node.x} y={node.y + nodeR + 30} textAnchor={'middle'}>
          {node.subTitle}
        </text>
      </g>
    </g>
  );
}

/**
 * Shows the outer segmented circle with different color for each response type.
 */
function ResponseTypeCircle(props: { node: NodeDatum }) {
  const { node } = props;
  const fullStat = node.arcSections.find(s => s.value === 1);
  if (fullStat) {
    // Doing arc with path does not work well so it's better to just do a circle in that case
    return <circle fill="none" stroke={fullStat.color} strokeWidth={2} r={nodeR} cx={node.x} cy={node.y} />;
  }

  const nonZero = node.arcSections.filter(s => s.value !== 0);

  const { elements } = nonZero.reduce(
    (acc, section) => {
      const el = (
        <ArcSection
          r={nodeR}
          x={node.x!}
          y={node.y!}
          startPercent={acc.percent}
          percent={section.value}
          color={section.color}
          strokeWidth={2}
        />
      );
      acc.elements.push(el);
      acc.percent = acc.percent + section.value;
      return acc;
    },
    { elements: [] as React.ReactNode[], percent: 0 }
  );

  return <>{elements}</>;
}

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
