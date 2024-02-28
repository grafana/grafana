import React, { useCallback, useMemo, useState } from 'react';

import { DashboardCursorSync, PanelProps } from '@grafana/data';
import { TooltipDisplayMode, TooltipPlugin2, usePanelContext, useTheme2 } from '@grafana/ui';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import {
  prepareTimelineFields,
  prepareTimelineLegendItems,
  TimelineMode,
} from 'app/core/components/TimelineChart/utils';

import { StateTimelineTooltip2 } from '../state-timeline/StateTimelineTooltip2';
import { AnnotationsPlugin2 } from '../timeseries/plugins/AnnotationsPlugin2';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { getTimezones } from '../timeseries/utils';

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

  // TODO: we should just re-init when this changes, and have this be a static setting
  const syncTooltip = useCallback(
    () => sync?.() === DashboardCursorSync.Tooltip,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // temp range set for adding new annotation set by TooltipPlugin2, consumed by AnnotationPlugin2
  const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);
  const { sync, canAddAnnotations } = usePanelContext();

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

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
      {(builder, alignedFrame) => {
        return (
          <>
            {options.tooltip.mode !== TooltipDisplayMode.None && (
              <TooltipPlugin2
                config={builder}
                hoverMode={
                  options.tooltip.mode === TooltipDisplayMode.Multi ? TooltipHoverMode.xAll : TooltipHoverMode.xOne
                }
                queryZoom={onChangeTimeRange}
                syncTooltip={syncTooltip}
                render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2, viaSync) => {
                  if (enableAnnotationCreation && timeRange2 != null) {
                    setNewAnnotationRange(timeRange2);
                    dismiss();
                    return;
                  }

                  const annotate = () => {
                    let xVal = u.posToVal(u.cursor.left!, 'x');

                    setNewAnnotationRange({ from: xVal, to: xVal });
                    dismiss();
                  };

                  return (
                    <StateTimelineTooltip2
                      frames={frames ?? []}
                      seriesFrame={alignedFrame}
                      dataIdxs={dataIdxs}
                      seriesIdx={seriesIdx}
                      mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                      sortOrder={options.tooltip.sort}
                      isPinned={isPinned}
                      timeRange={timeRange}
                      annotate={enableAnnotationCreation ? annotate : undefined}
                      withDuration={false}
                    />
                  );
                }}
                maxWidth={options.tooltip.maxWidth}
                maxHeight={options.tooltip.maxHeight}
              />
            )}
            <AnnotationsPlugin2
              annotations={data.annotations ?? []}
              config={builder}
              timeZone={timeZone}
              newRange={newAnnotationRange}
              setNewRange={setNewAnnotationRange}
              canvasRegionRendering={false}
            />
            <OutsideRangePlugin config={builder} onChangeTimeRange={onChangeTimeRange} />
          </>
        );
      }}
    </TimelineChart>
  );
};
