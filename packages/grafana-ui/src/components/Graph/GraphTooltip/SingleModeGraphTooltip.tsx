import React from 'react';
import {
  getValueFromDimension,
  getColumnFromDimension,
  formattedValueToString,
  getDisplayProcessor,
} from '@grafana/data';
import { SeriesTable } from './SeriesTable';
import { GraphTooltipContentProps } from './types';

export const SingleModeGraphTooltip: React.FC<GraphTooltipContentProps> = ({
  dimensions,
  activeDimensions,
  timeZone,
}) => {
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
  const processedTime = timeField.display ? formattedValueToString(timeField.display(time)) : time;

  const valueField = getColumnFromDimension(dimensions.yAxis, activeDimensions.yAxis[0]);
  const value = getValueFromDimension(dimensions.yAxis, activeDimensions.yAxis[0], activeDimensions.yAxis[1]);
  const display = valueField.display ?? getDisplayProcessor({ field: valueField, timeZone });
  const disp = display(value);

  return (
    <SeriesTable
      series={[
        {
          color: disp.color,
          label: valueField.name,
          value: formattedValueToString(disp),
        },
      ]}
      timestamp={processedTime}
    />
  );
};

SingleModeGraphTooltip.displayName = 'SingleModeGraphTooltip';
