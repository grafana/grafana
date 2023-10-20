import React, { MouseEvent, memo } from 'react';

import { EdgeArrowMarker } from './EdgeArrowMarker';
import { computeNodeCircumferenceStrokeWidth, nodeR } from './Node';
import { EdgeDatum, NodeDatum } from './types';
import { shortenLine } from './utils';

export const highlightedEdgeColor = '#a00';

interface Props {
  edge: EdgeDatum;
  hovering: boolean;
  onClick: (event: MouseEvent<SVGElement>, link: EdgeDatum) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}

export const scaledEdgeThickness = (e: EdgeDatum) => 10 + e.thickness * 2;

export const Edge = memo(function Edge(props: Props) {
  const { edge, onClick, onMouseEnter, onMouseLeave, hovering } = props;

  // Not great typing but after we do layout these properties are full objects not just references
  const { source, target, sourceNodeRadius, targetNodeRadius } = edge as {
    source: NodeDatum;
    target: NodeDatum;
    sourceNodeRadius: number;
    targetNodeRadius: number;
  };

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
    scaledEdgeThickness(edge)
  );

  const markerId = `triangle-${edge.id}`;
  const coloredMarkerId = `triangle-colored-${edge.id}`;

  return (
    <>
      <EdgeArrowMarker id={markerId} size={scaledEdgeThickness(edge)} />
      <EdgeArrowMarker id={coloredMarkerId} fill={highlightedEdgeColor} size={scaledEdgeThickness(edge)} />
      <g
        onClick={(event) => onClick(event, edge)}
        style={{ cursor: 'pointer' }}
        aria-label={`Edge from: ${source.id} to: ${target.id}`}
      >
        <line
          strokeWidth={(hovering ? 1 : 0) + (edge.highlighted ? 1 : 0) + edge.thickness}
          stroke={edge.highlighted ? highlightedEdgeColor : '#999'}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
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
