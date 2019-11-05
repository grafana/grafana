import React from 'react';
import { getValueFromDimension, getColumnFromDimension } from '@grafana/data';
import { SeriesTable } from './SeriesTable';
import { GraphTooltipContentProps } from './types';

export const SingleModeGraphTooltip: React.FC<GraphTooltipContentProps> = ({ dimensions, activeDimensions }) => {
  // not hovering over a point, skip rendering
  if (
    activeDimensions.yAxis === null ||
    activeDimensions.yAxis[1] === undefined ||
    activeDimensions.xAxis === null ||
    activeDimensions.xAxis[1] === undefined
  ) {
    return null;
  }
  const time = getValueFromDimension(dimensions.xAxis, activeDimensions.xAxis[0], activeDimensions.xAxis[1]);
  const timeField = getColumnFromDimension(dimensions.xAxis, activeDimensions.xAxis[0]);
  const processedTime = timeField.display ? timeField.display(time).text : time;

  const valueField = getColumnFromDimension(dimensions.yAxis, activeDimensions.yAxis[0]);
  const value = getValueFromDimension(dimensions.yAxis, activeDimensions.yAxis[0], activeDimensions.yAxis[1]);
  const processedValue = valueField.display ? valueField.display(value).text : value;

  return (
    <SeriesTable
      series={[{ color: valueField.config.color, label: valueField.name, value: processedValue }]}
      timestamp={processedTime}
    />
  );
};

SingleModeGraphTooltip.displayName = 'SingleModeGraphTooltip';
