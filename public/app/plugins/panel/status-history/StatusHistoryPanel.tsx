import React, { useMemo } from 'react';

import { PanelProps } from '@grafana/data';
import { TooltipPlugin, useTheme2, ZoomPlugin } from '@grafana/ui';

import { TimelineChart } from '../state-timeline/TimelineChart';
import { TimelineMode } from '../state-timeline/types';
import { prepareTimelineFields, prepareTimelineLegendItems } from '../state-timeline/utils';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { getTimezones } from '../timeseries/utils';

import { StatusPanelOptions } from './types';

interface TimelinePanelProps extends PanelProps<StatusPanelOptions> {}

/**
 * @alpha
 */
export const StatusHistoryPanel: React.FC<TimelinePanelProps> = ({
  data,
  timeRange,
  timeZone,
  options,
  width,
  height,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();

  const { frames, warn } = useMemo(
    () => prepareTimelineFields(data?.series, false, timeRange, theme),
    [data, timeRange, theme]
  );

  const legendItems = useMemo(
    () => prepareTimelineLegendItems(frames, options.legend, theme),
    [frames, options.legend, theme]
  );

  const timezones = useMemo(() => getTimezones(options.timezones, timeZone), [options.timezones, timeZone]);

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  // Status grid requires some space between values
  if (frames[0].length > width / 2) {
    return (
      <div className="panel-empty">
        <p>
          Too many points to visualize properly. <br />
          Update the query to return fewer points. <br />({frames[0].length} points received)
        </p>
      </div>
    );
  }

  return (
    <TimelineChart
      theme={theme}
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZones={timezones}
      width={width}
      height={height}
      legendItems={legendItems}
      {...options}
      // hardcoded
      mode={TimelineMode.Samples}
    >
      {(config, alignedFrame) => {
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />
            <OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />
          </>
        );
      }}
    </TimelineChart>
  );
};
