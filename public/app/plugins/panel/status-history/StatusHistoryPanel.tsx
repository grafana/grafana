import { useMemo, useState } from 'react';

import { DashboardCursorSync, PanelProps, useDataLinksContext } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { PanelDataErrorView } from '@grafana/runtime';
import {
  AxisPlacement,
  EventBusPlugin,
  TooltipDisplayMode,
  TooltipPlugin2,
  usePanelContext,
  useTheme2,
} from '@grafana/ui';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/internal';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import {
  prepareTimelineFields,
  prepareTimelineLegendItems,
  TimelineMode,
} from 'app/core/components/TimelineChart/utils';

import { StateTimelineTooltip2 } from '../state-timeline/StateTimelineTooltip2';
import { containerStyles, usePagination } from '../state-timeline/utils';
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
  fieldConfig,
  replaceVariables,
  onChangeTimeRange,
  id: panelId,
}: TimelinePanelProps) => {
  const theme = useTheme2();

  // temp range set for adding new annotation set by TooltipPlugin2, consumed by AnnotationPlugin2
  const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);
  const { sync, eventsScope, canAddAnnotations, eventBus, canExecuteActions } = usePanelContext();
  const { dataLinkPostProcessor } = useDataLinksContext();
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);

  const { frames, warn } = useMemo(
    () => prepareTimelineFields(data.series, false, timeRange, theme),
    [data.series, timeRange, theme]
  );

  const { paginatedFrames, paginationRev, paginationElement, paginationHeight } = usePagination(
    frames,
    options.perPage
  );

  const legendItems = useMemo(
    () => prepareTimelineLegendItems(paginatedFrames, options.legend, theme),
    [paginatedFrames, options.legend, theme]
  );

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);

  if (!paginatedFrames || typeof warn === 'string') {
    return <PanelDataErrorView panelId={panelId} fieldConfig={fieldConfig} data={data} message={warn} needsTimeField />;
  }

  // Status grid requires some space between values
  if (paginatedFrames[0].length > width / 2) {
    return (
      <div className="panel-empty">
        <p>
          <Trans i18nKey="status-history.status-history-panel.too-many-points" count={paginatedFrames[0].length}>
            Too many points to visualize properly. <br />
            Update the query to return fewer points. <br />({'{{count}}'} points received)
          </Trans>
        </p>
      </div>
    );
  }

  return (
    <div className={containerStyles.container}>
      <TimelineChart
        theme={theme}
        frames={paginatedFrames}
        structureRev={data.structureRev}
        paginationRev={paginationRev}
        timeRange={timeRange}
        timeZone={timezones}
        width={width}
        height={height - paginationHeight}
        legendItems={legendItems}
        {...options}
        mode={TimelineMode.Samples}
        replaceVariables={replaceVariables}
        dataLinkPostProcessor={dataLinkPostProcessor}
        cursorSync={cursorSync}
      >
        {(builder, alignedFrame) => {
          return (
            <>
              {cursorSync !== DashboardCursorSync.Off && (
                <EventBusPlugin config={builder} eventBus={eventBus} frame={alignedFrame} />
              )}
              {options.tooltip.mode !== TooltipDisplayMode.None && (
                <TooltipPlugin2
                  config={builder}
                  hoverMode={
                    options.tooltip.mode === TooltipDisplayMode.Multi ? TooltipHoverMode.xAll : TooltipHoverMode.xOne
                  }
                  queryZoom={onChangeTimeRange}
                  syncMode={cursorSync}
                  syncScope={eventsScope}
                  getDataLinks={(seriesIdx, dataIdx) =>
                    alignedFrame.fields[seriesIdx].getLinks?.({ valueRowIndex: dataIdx }) ?? []
                  }
                  render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2, viaSync, dataLinks) => {
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
                        series={alignedFrame}
                        dataIdxs={dataIdxs}
                        seriesIdx={seriesIdx}
                        mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                        sortOrder={options.tooltip.sort}
                        isPinned={isPinned}
                        timeRange={timeRange}
                        annotate={enableAnnotationCreation ? annotate : undefined}
                        withDuration={false}
                        maxHeight={options.tooltip.maxHeight}
                        replaceVariables={replaceVariables}
                        dataLinks={dataLinks}
                        canExecuteActions={userCanExecuteActions}
                      />
                    );
                  }}
                  maxWidth={options.tooltip.maxWidth}
                />
              )}
              {alignedFrame.fields[0].config.custom?.axisPlacement !== AxisPlacement.Hidden && (
                <AnnotationsPlugin2
                  annotations={data.annotations ?? []}
                  config={builder}
                  timeZone={timeZone}
                  newRange={newAnnotationRange}
                  setNewRange={setNewAnnotationRange}
                  canvasRegionRendering={false}
                />
              )}
              <OutsideRangePlugin config={builder} onChangeTimeRange={onChangeTimeRange} />
            </>
          );
        }}
      </TimelineChart>
      {paginationElement}
    </div>
  );
};
