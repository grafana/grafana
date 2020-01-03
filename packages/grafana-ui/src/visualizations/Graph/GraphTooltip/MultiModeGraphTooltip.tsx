import React from 'react';
import { SeriesTable } from './SeriesTable';
import { GraphTooltipContentProps } from './types';
import { getMultiSeriesGraphHoverInfo } from '../utils';
import { FlotPosition } from '../types';
import { getValueFromDimension } from '@grafana/data';

export const MultiModeGraphTooltip: React.FC<GraphTooltipContentProps & {
  // We expect position to figure out correct values when not hovering over a datapoint
  pos: FlotPosition;
}> = ({ dimensions, activeDimensions, pos }) => {
  let activeSeriesIndex: number | null = null;
  // when no x-axis provided, skip rendering
  if (activeDimensions.xAxis === null) {
    return null;
  }

  if (activeDimensions.yAxis) {
    activeSeriesIndex = activeDimensions.yAxis[0];
  }

  // when not hovering over a point, time is undefined, and we use pos.x as time
  const time = activeDimensions.xAxis[1]
    ? getValueFromDimension(dimensions.xAxis, activeDimensions.xAxis[0], activeDimensions.xAxis[1])
    : pos.x;

  const hoverInfo = getMultiSeriesGraphHoverInfo(dimensions.yAxis.columns, dimensions.xAxis.columns, time);
  const timestamp = hoverInfo.time;

  const series = hoverInfo.results.map((s, i) => {
    return {
      color: s.color,
      label: s.label,
      value: s.value,
      isActive: activeSeriesIndex === i,
    };
  });

  return <SeriesTable series={series} timestamp={timestamp} />;
};

MultiModeGraphTooltip.displayName = 'MultiModeGraphTooltip';
