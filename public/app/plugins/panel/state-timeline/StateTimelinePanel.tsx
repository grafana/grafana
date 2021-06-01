import React, { useCallback, useMemo } from 'react';
import {
  DataFrame,
  FALLBACK_COLOR,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  getValueFormat,
  PanelProps,
} from '@grafana/data';
import { TooltipDisplayMode, TooltipPlugin, useTheme2, ZoomPlugin } from '@grafana/ui';
import { TimelineMode, TimelineOptions } from './types';
import { TimelineChart } from './TimelineChart';
import { findNextStateIndex, prepareTimelineFields, prepareTimelineLegendItems } from './utils';
import { SeriesTableRow } from '@grafana/ui/src/components/VizTooltip';

interface TimelinePanelProps extends PanelProps<TimelineOptions> {}

/**
 * @alpha
 */
export const StateTimelinePanel: React.FC<TimelinePanelProps> = ({
  data,
  timeRange,
  timeZone,
  options,
  width,
  height,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();

  const { frames, warn } = useMemo(() => prepareTimelineFields(data?.series, options.mergeValues ?? true), [
    data,
    options.mergeValues,
  ]);

  const legendItems = useMemo(() => prepareTimelineLegendItems(frames, options.legend, theme), [
    frames,
    options.legend,
    theme,
  ]);

  const renderCustomTooltip = useCallback(
    (alignedFrame: DataFrame, seriesIdx: number | null, datapointIdx: number | null) => {
      // Not caring about multi mode in StateTimeline
      if (seriesIdx === null && datapointIdx === null) {
        return null;
      }
      const xField = alignedFrame.fields[0];
      const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

      const field = alignedFrame.fields[seriesIdx!];
      const dataFrameFieldIndex = field.state?.origin;
      const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
      const value = field.values.get(datapointIdx!);
      const display = fieldFmt(value);
      const fieldDisplayName = dataFrameFieldIndex
        ? getFieldDisplayName(
            data.series[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex],
            data.series[dataFrameFieldIndex.frameIndex],
            data.series
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
        const duration =
          nextStateTs && formattedValueToString(getValueFormat('dtdurationms')(nextStateTs - stateTs, 0));
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
    },
    [theme, timeZone, data]
  );

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  return (
    <TimelineChart
      theme={theme}
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legendItems={legendItems}
      {...options}
      // hardcoded
      mode={TimelineMode.Changes}
    >
      {(config, alignedFrame) => {
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            {options.tooltip.mode !== TooltipDisplayMode.None && (
              <TooltipPlugin
                data={alignedFrame}
                config={config}
                mode={options.tooltip.mode}
                timeZone={timeZone}
                renderTooltip={renderCustomTooltip}
              />
            )}
          </>
        );
      }}
    </TimelineChart>
  );
};
