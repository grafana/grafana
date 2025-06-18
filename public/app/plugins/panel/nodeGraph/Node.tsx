import { css } from '@emotion/css';
import cx from 'classnames';
import { MouseEvent, memo } from 'react';
import tinycolor from 'tinycolor2';

import { Field, getFieldColorModeForField, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useTheme2 } from '@grafana/ui';

import { HoverState } from './NodeGraph';
import { NodeDatum } from './types';
import { statToString } from './utils';

export const nodeR = 40;
export const highlightedNodeColor = '#a00';

const getStyles = (theme: GrafanaTheme2, hovering: HoverState) => ({
  mainGroup: css({
    cursor: 'pointer',
    fontSize: '10px',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 300ms',
    },
    opacity: hovering === 'inactive' ? 0.5 : 1,
  }),

  mainCircle: css({
    fill: theme.components.panel.background,
  }),

  filledCircle: css({
    fill: highlightedNodeColor,
  }),

  hoverCircle: css({
    opacity: 0.5,
    fill: 'transparent',
    stroke: theme.colors.primary.text,
  }),

  text: css({
    fill: theme.colors.text.primary,
    pointerEvents: 'none',
  }),

  titleText: css({
    textAlign: 'center',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    backgroundColor: tinycolor(theme.colors.background.primary).setAlpha(0.6).toHex8String(),
    width: '140px',
  }),

  statsText: css({
    textAlign: 'center',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    width: '70px',
  }),

  textHovering: css({
    width: '200px',
    '& span': {
      backgroundColor: tinycolor(theme.colors.background.primary).setAlpha(0.8).toHex8String(),
    },
  }),

  clickTarget: css({
    fill: 'none',
    stroke: 'none',
    pointerEvents: 'fill',
  }),
});

export const computeNodeCircumferenceStrokeWidth = (nodeRadius: number) => Math.ceil(nodeRadius * 0.075);

export const Node = memo(function Node(props: {
  node: NodeDatum;
  hovering: HoverState;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  onClick: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
}) {
  const { node, onMouseEnter, onMouseLeave, onClick, hovering } = props;
  const theme = useTheme2();
  const styles = getStyles(theme, hovering);
  const isHovered = hovering === 'active';
  const nodeRadius = node.nodeRadius?.values[node.dataFrameRowIndex] || nodeR;
  const strokeWidth = computeNodeCircumferenceStrokeWidth(nodeRadius);

  if (!(node.x !== undefined && node.y !== undefined)) {
    return null;
  }

  return (
    <g
      data-node-id={node.id}
      className={styles.mainGroup}
      aria-label={t('nodeGraph.node.aria-label-node-title', 'Node: {{nodeName}}', { nodeName: node.title })}
    >
      <circle
        data-testid={`node-circle-${node.id}`}
        className={node.highlighted ? styles.filledCircle : styles.mainCircle}
        r={nodeRadius}
        cx={node.x}
        cy={node.y}
      />
      {isHovered && (
        <circle className={styles.hoverCircle} r={nodeRadius - 3} cx={node.x} cy={node.y} strokeWidth={strokeWidth} />
      )}
      <ColorCircle node={node} />
      <g className={styles.text} style={{ pointerEvents: 'none' }}>
        <NodeContents node={node} hovering={hovering} />
        <foreignObject
          x={node.x - (isHovered ? 100 : 70)}
          y={node.y + nodeRadius + 5}
          width={isHovered ? '200' : '140'}
          height="40"
        >
          <div className={cx(styles.titleText, isHovered && styles.textHovering)}>
            <span>{node.title}</span>
            <br />
            <span>{node.subTitle}</span>
          </div>
        </foreignObject>
      </g>
      <rect
        data-testid={`node-click-rect-${node.id}`}
        onMouseEnter={() => {
          onMouseEnter(node.id);
        }}
        onMouseLeave={() => {
          onMouseLeave(node.id);
        }}
        onClick={(event) => {
          onClick(event, node);
        }}
        className={styles.clickTarget}
        x={node.x - nodeRadius - 5}
        y={node.y - nodeRadius - 5}
        width={nodeRadius * 2 + 10}
        height={nodeRadius * 2 + 50}
      />
    </g>
  );
});

/**
 * Shows contents of the node which can be either an Icon or a main and secondary stat values.
 */
function NodeContents({ node, hovering }: { node: NodeDatum; hovering: HoverState }) {
  const theme = useTheme2();
  const styles = getStyles(theme, hovering);
  const isHovered = hovering === 'active';

  if (!(node.x !== undefined && node.y !== undefined)) {
    return null;
  }

  return node.icon ? (
    <foreignObject x={node.x - 35} y={node.y - 20} width="70" height="40">
      <div style={{ width: 70, overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: -4 }}>
        <Icon data-testid={`node-icon-${node.icon}`} name={node.icon} size={'xxxl'} />
      </div>
    </foreignObject>
  ) : (
    <foreignObject x={node.x - (isHovered ? 100 : 35)} y={node.y - 15} width={isHovered ? '200' : '70'} height="40">
      <div className={cx(styles.statsText, isHovered && styles.textHovering)}>
        <span>{node.mainStat && statToString(node.mainStat.config, node.mainStat.values[node.dataFrameRowIndex])}</span>
        <br />
        <span>
          {node.secondaryStat &&
            statToString(node.secondaryStat.config, node.secondaryStat.values[node.dataFrameRowIndex])}
        </span>
      </div>
    </foreignObject>
  );
}

/**
 * Shows the outer segmented circle with different colors based on the supplied data.
 */
function ColorCircle(props: { node: NodeDatum }) {
  const { node } = props;
  const fullStat = node.arcSections.find((s) => s.values[node.dataFrameRowIndex] >= 1);
  const theme = useTheme2();
  const nodeRadius = node.nodeRadius?.values[node.dataFrameRowIndex] || nodeR;
  const strokeWidth = computeNodeCircumferenceStrokeWidth(nodeRadius);

  if (fullStat) {
    // Drawing a full circle with a `path` tag does not work well, it's better to use a `circle` tag in that case
    return (
      <circle
        fill="none"
        stroke={theme.visualization.getColorByName(fullStat.config.color?.fixedColor || '')}
        strokeWidth={strokeWidth}
        r={nodeRadius}
        cx={node.x}
        cy={node.y}
      />
    );
  }

  const nonZero = node.arcSections.filter((s) => s.values[node.dataFrameRowIndex] !== 0);
  if (nonZero.length === 0) {
    // Fallback if no arc is defined
    return (
      <circle
        fill="none"
        stroke={node.color ? getColor(node.color, node.dataFrameRowIndex, theme) : 'gray'}
        strokeWidth={strokeWidth}
        r={nodeRadius}
        cx={node.x}
        cy={node.y}
      />
    );
  }

  const { elements } = nonZero.reduce<{
    elements: React.ReactNode[];
    percent: number;
  }>(
    (acc, section, index) => {
      const color = section.config.color?.fixedColor || '';
      const value = section.values[node.dataFrameRowIndex];

      const el = (
        <ArcSection
          key={index}
          r={nodeRadius}
          x={node.x!}
          y={node.y!}
          startPercent={acc.percent}
          percent={
            value + acc.percent > 1
              ? // If the values aren't correct and add up to more than 100% lets still render correctly the amounts we
                // already have and cap it at 100%
                1 - acc.percent
              : value
          }
          color={theme.visualization.getColorByName(color)}
          strokeWidth={strokeWidth}
        />
      );
      acc.elements.push(el);
      acc.percent = acc.percent + value;
      return acc;
    },
    { elements: [], percent: 0 }
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

function getColor(field: Field, index: number, theme: GrafanaTheme2): string {
  if (!field.config.color) {
    return field.values[index];
  }

  return getFieldColorModeForField(field).getCalculator(field, theme)(0, field.values[index]);
}
