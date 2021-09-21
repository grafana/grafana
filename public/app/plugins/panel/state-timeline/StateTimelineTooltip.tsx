import React from 'react';
import {
  DataFrame,
  FALLBACK_COLOR,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  getValueFormat,
  TimeZone,
} from '@grafana/data';
import { SeriesTableRow, useTheme2 } from '@grafana/ui';
import { findNextStateIndex } from './utils';

interface StateTimelineTooltipProps {
  data: DataFrame[];
  alignedData: DataFrame;
  seriesIdx: number;
  datapointIdx: number;
  timeZone: TimeZone;
}

export const StateTimelineTooltip: React.FC<StateTimelineTooltipProps> = ({
  data,
  alignedData,
  seriesIdx,
  datapointIdx,
  timeZone,
}) => {
  const theme = useTheme2();

  const xField = alignedData.fields[0];
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

  const field = alignedData.fields[seriesIdx!];
  const dataFrameFieldIndex = field.state?.origin;
  const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
  const value = field.values.get(datapointIdx!);
  const display = fieldFmt(value);
  const fieldDisplayName = dataFrameFieldIndex
    ? getFieldDisplayName(
        data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex],
        data[dataFrameFieldIndex.frameIndex],
        data
      )
    : null;

  const nextStateIdx = findNextStateIndex(field, datapointIdx!);
  let nextStateTs;
  if (nextStateIdx) {
    nextStateTs = xField.values.get(nextStateIdx!);
  }

  const stateTs = xField.values.get(datapointIdx!);

  let toFragment = null;
  let durationFragment = null;

  if (nextStateTs) {
    const duration = nextStateTs && formattedValueToString(getValueFormat('dtdurationms')(nextStateTs - stateTs, 0));
    durationFragment = (
      <>
        <br />
        <strong>Duration:</strong> {duration}
      </>
    );
    toFragment = (
      <>
        {' to'} <strong>{xFieldFmt(xField.values.get(nextStateIdx!)).text}</strong>
      </>
    );
  }

  return (
    <div style={{ fontSize: theme.typography.bodySmall.fontSize }}>
      {fieldDisplayName}
      <br />
      <SeriesTableRow label={display.text} color={display.color || FALLBACK_COLOR} isActive />
      From <strong>{xFieldFmt(xField.values.get(datapointIdx!)).text}</strong>
      {toFragment}
      {durationFragment}
    </div>
  );
};

StateTimelineTooltip.displayName = 'StateTimelineTooltip';
