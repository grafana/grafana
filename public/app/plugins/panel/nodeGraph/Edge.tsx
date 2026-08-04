import { type MouseEvent, memo } from 'react';

import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

import { EdgeArrowMarker } from './EdgeArrowMarker';
import { computeNodeCircumferenceStrokeWidth, nodeR } from './Node';
import { type EdgeDatumLayout, type NodeDatum } from './types';
import { shortenLine } from './utils';

const defaultHighlightedEdgeColor = '#a00';
export const defaultEdgeColor = '#999';

interface Props {
  edge: EdgeDatumLayout;
  hovering: boolean;
  svgIdNamespace: string;
  onClick: (event: MouseEvent<SVGElement>, link: EdgeDatumLayout) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}

export const Edge = memo(function Edge(props: Props) {
  const { edge, onClick, onMouseEnter, onMouseLeave, hovering, svgIdNamespace } = props;
  const theme = useTheme2();

  // Not great typing but after we do layout these properties are full objects not just references
  const { source, target, sourceNodeRadius, targetNodeRadius } = edge as {
    source: NodeDatum;
    target: NodeDatum;
    sourceNodeRadius: number;
    targetNodeRadius: number;
  };
  // An item override beats the data-driven thickness/color/strokeDasharray columns, the same way
  // a field override beats datasource-supplied field config.
  const thickness = edge.itemConfig?.custom?.thickness ?? edge.thickness;
  const overrideFixedColor = edge.itemConfig?.color?.fixedColor;
  const resolvedOverrideColor = overrideFixedColor ? theme.visualization.getColorByName(overrideFixedColor) : undefined;
  const strokeDasharray = edge.itemConfig?.custom?.strokeDasharray ?? edge.strokeDasharray;

  const arrowHeadHeight = 10 + thickness * 2; // resized value, just to make the UI nicer

  // As the nodes have some radius we want edges to end outside of the node circle.
  const line = shortenLine(
    {
      x1: source.x!,
      y1: source.y!,
      x2: target.x!,
      y2: target.y!,
    },
    sourceNodeRadius + computeNodeCircumferenceStrokeWidth(sourceNodeRadius) / 2 || nodeR,
    targetNodeRadius + computeNodeCircumferenceStrokeWidth(targetNodeRadius) / 2 || nodeR,
    arrowHeadHeight
  );

  const edgeColor = resolvedOverrideColor ?? edge.color ?? defaultEdgeColor;

  // @deprecated -- until 'highlighted' is removed we'll prioritize 'color'
  // in case both are provided
  const highlightedEdgeColor = resolvedOverrideColor ?? edge.color ?? defaultHighlightedEdgeColor;

  const markerId = `triangle-${svgIdNamespace}-${edge.id}`;
  const coloredMarkerId = `triangle-colored-${svgIdNamespace}-${edge.id}`;

  return (
    <>
      <EdgeArrowMarker id={markerId} fill={edgeColor} headHeight={arrowHeadHeight} />
      <EdgeArrowMarker id={coloredMarkerId} fill={highlightedEdgeColor} headHeight={arrowHeadHeight} />
      <g
        onClick={(event) => onClick(event, edge)}
        style={{ cursor: 'pointer' }}
        aria-label={t('nodeGraph.edge.aria-label-from-to', 'Edge from: {{from}} to: {{to}}', {
          from: source.id,
          to: target.id,
        })}
      >
        <line
          strokeWidth={(hovering ? 1 : 0) + (edge.highlighted ? 1 : 0) + thickness}
          stroke={edge.highlighted ? highlightedEdgeColor : edgeColor}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          strokeDasharray={strokeDasharray}
          markerEnd={`url(#${edge.highlighted ? coloredMarkerId : markerId})`}
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
    </>
  );
});
