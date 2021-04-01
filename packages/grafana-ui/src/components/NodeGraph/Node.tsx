import React, { MouseEvent, memo } from 'react';
import { css } from '@emotion/css';
import tinycolor from 'tinycolor2';
import cx from 'classnames';
import { getColorForTheme, GrafanaTheme } from '@grafana/data';
import { NodeDatum } from './types';
import { stylesFactory, useTheme } from '../../themes';

const nodeR = 40;

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  mainGroup: css`
    cursor: pointer;
    font-size: 10px;
  `,

  mainCircle: css`
    fill: ${theme.colors.panelBg};
  `,

  hoverCircle: css`
    opacity: 0.5;
    fill: transparent;
    stroke: ${theme.colors.textBlue};
  `,

  text: css`
    fill: ${theme.colors.text};
  `,

  titleText: css`
    text-align: center;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    background-color: ${tinycolor(theme.colors.bodyBg).setAlpha(0.6).toHex8String()};
    width: 100px;
  `,

  statsText: css`
    text-align: center;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    width: 70px;
  `,

  textHovering: css`
    width: 200px;
    & span {
      background-color: ${tinycolor(theme.colors.bodyBg).setAlpha(0.8).toHex8String()};
    }
  `,
}));

export const Node = memo(function Node(props: {
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
      className={styles.mainGroup}
      onMouseEnter={() => {
        onMouseEnter(node.id);
      }}
      onMouseLeave={() => {
        onMouseLeave(node.id);
      }}
      onClick={(event) => {
        onClick(event, node);
      }}
      aria-label={`Node: ${node.title}`}
    >
      <circle className={styles.mainCircle} r={nodeR} cx={node.x} cy={node.y} />
      {hovering && <circle className={styles.hoverCircle} r={nodeR - 3} cx={node.x} cy={node.y} strokeWidth={2} />}
      <ColorCircle node={node} />
      <g className={styles.text}>
        <foreignObject x={node.x - (hovering ? 100 : 35)} y={node.y - 15} width={hovering ? '200' : '70'} height="30">
          <div className={cx(styles.statsText, hovering && styles.textHovering)}>
            <span>{node.mainStat}</span>
            <br />
            <span>{node.secondaryStat}</span>
          </div>
        </foreignObject>
        <foreignObject
          x={node.x - (hovering ? 100 : 50)}
          y={node.y + nodeR + 5}
          width={hovering ? '200' : '100'}
          height="30"
        >
          <div className={cx(styles.titleText, hovering && styles.textHovering)}>
            <span>{node.title}</span>
            <br />
            <span>{node.subTitle}</span>
          </div>
        </foreignObject>
      </g>
    </g>
  );
});

/**
 * Shows the outer segmented circle with different colors based on the supplied data.
 */
function ColorCircle(props: { node: NodeDatum }) {
  const { node } = props;
  const fullStat = node.arcSections.find((s) => s.value === 1);
  const theme = useTheme();

  if (fullStat) {
    // Doing arc with path does not work well so it's better to just do a circle in that case
    return (
      <circle
        fill="none"
        stroke={getColorForTheme(fullStat.color, theme)}
        strokeWidth={2}
        r={nodeR}
        cx={node.x}
        cy={node.y}
      />
    );
  }

  const nonZero = node.arcSections.filter((s) => s.value !== 0);
  if (nonZero.length === 0) {
    // Fallback if no arc is defined
    return <circle fill="none" stroke={node.color} strokeWidth={2} r={nodeR} cx={node.x} cy={node.y} />;
  }

  const { elements } = nonZero.reduce(
    (acc, section) => {
      const el = (
        <ArcSection
          key={section.color}
          r={nodeR}
          x={node.x!}
          y={node.y!}
          startPercent={acc.percent}
          percent={section.value}
          color={getColorForTheme(section.color, theme)}
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
