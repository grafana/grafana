import React, { useCallback, useMemo } from 'react';
import { DataFrame, PanelProps } from '@grafana/data';
import { TooltipPlugin, useTheme2, ZoomPlugin } from '@grafana/ui';
import { TimelineMode, TimelineOptions } from './types';
import { TimelineChart } from './TimelineChart';
import { prepareTimelineFields, prepareTimelineLegendItems } from './utils';
import { StateTimelineTooltip } from './StateTimelineTooltip';

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
    (alignedData: DataFrame, seriesIdx: number | null, datapointIdx: number | null) => {
      // Not caring about multi mode in StateTimeline
      if (seriesIdx === null || datapointIdx === null) {
        return null;
      }

      return (
        <StateTimelineTooltip
          data={frames ?? []}
          alignedData={alignedData}
          seriesIdx={seriesIdx}
          datapointIdx={datapointIdx}
          timeZone={timeZone}
        />
      );
    },
    [timeZone, frames]
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
      mode={TimelineMode.Changes}
    >
      {(config, alignedFrame) => {
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            <TooltipPlugin
              data={alignedFrame}
              config={config}
              mode={options.tooltip.mode}
              timeZone={timeZone}
              renderTooltip={renderCustomTooltip}
            />
          </>
        );
      }}
    </TimelineChart>
  );
};
