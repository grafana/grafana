import React, { useMemo } from 'react';

import { PanelProps } from '@grafana/data';
import { useTheme2, TooltipDisplayMode, TooltipPlugin2, ZoomPlugin } from '@grafana/ui';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import {
  prepareTimelineFields,
  prepareTimelineLegendItems,
  TimelineMode,
} from 'app/core/components/TimelineChart/utils';

import { getTimezones } from '../timeseries/utils';

import { StatusHistoryTooltip } from './StatusHistoryTooltip';
import { Options } from './panelcfg.gen';

interface TimelinePanelProps extends PanelProps<Options> {}

/**
 * @alpha
 */
export const StatusHistoryPanel = ({
  data,
  timeRange,
  timeZone,
  options,
  width,
  height,
  onChangeTimeRange,
}: TimelinePanelProps) => {
  const theme = useTheme2();

  const { frames, warn } = useMemo(
    () => prepareTimelineFields(data.series, false, timeRange, theme),
    [data.series, timeRange, theme]
  );

  const legendItems = useMemo(
    () => prepareTimelineLegendItems(frames, options.legend, theme),
    [frames, options.legend, theme]
  );

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);

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
      timeZone={timezones}
      width={width}
      height={height}
      legendItems={legendItems}
      {...options}
      mode={TimelineMode.Samples}
    >
      {(config, alignedFrame) => (
        <>
          <ZoomPlugin
            config={config}
            onZoom={({ from, to }) => {
              onChangeTimeRange({ from, to });
            }}
          />
          {options.tooltip.mode !== TooltipDisplayMode.None && (
            <TooltipPlugin2
              config={config}
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss) => {
                return (
                  <StatusHistoryTooltip
                    data={frames ?? []}
                    dataIdxs={dataIdxs}
                    alignedData={alignedFrame}
                    seriesIdx={seriesIdx}
                    timeZone={timeZone}
                    isPinned={isPinned}
                  />
                );
              }}
            />
          )}
        </>
      )}
    </TimelineChart>
  );
};
