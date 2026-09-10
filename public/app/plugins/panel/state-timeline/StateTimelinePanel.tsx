import cx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DashboardCursorSync, type DataFrame, type PanelProps, useDataLinksContext } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import {
  AxisPlacement,
  EventBusPlugin,
  TooltipDisplayMode,
  TooltipPlugin2,
  usePanelContext,
  useTheme2,
  XAxisInteractionAreaPlugin,
} from '@grafana/ui';
import { type TimeRange2, TooltipHoverMode } from '@grafana/ui/internal';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import {
  prepareTimelineFields,
  prepareTimelineLegendItems,
  TimelineMode,
} from 'app/core/components/TimelineChart/utils';
import { STATE_TIMELINE_AUTO_HEIGHT_EVENT } from 'app/core/constants';
import { getFilterByGroupedLabels } from 'app/features/panel/filters/adhoc';

import { AnnotationsPlugin } from '../timeseries/plugins/AnnotationsPlugin';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { getXAnnotationFrames } from '../timeseries/plugins/utils';
import { getTimezones } from '../timeseries/utils';

import { StateTimelineTooltip } from './StateTimelineTooltip';
import { usePagination } from './hooks';
import { defaultOptions, type Options } from './panelcfg.gen';
import { containerStyles, getFixedHeightContainerStyles } from './styles';

interface TimelinePanelProps extends PanelProps<Options> {}

// Fixed-row modes size the uPlot canvas plus the x-axis area.
const TIMELINE_CHART_FIXED_HEIGHT_PADDING = 34;
const PAGINATION_FOOTER_HEIGHT_FALLBACK = 40;

export const StateTimelinePanel = ({
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
  const {
    sync,
    eventsScope,
    canAddAnnotations,
    eventBus,
    canExecuteActions,
    getFiltersBasedOnGrouping,
    onAddAdHocFilters,
  } = usePanelContext();

  const { dataLinkPostProcessor } = useDataLinksContext();

  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  const getFilterByGroupedLabelsModel = useCallback(
    (frame: DataFrame, seriesIdx: number | null | undefined) =>
      getFilterByGroupedLabels(frame, seriesIdx, getFiltersBasedOnGrouping, onAddAdHocFilters),
    [getFiltersBasedOnGrouping, onAddAdHocFilters]
  );

  const { frames, warn } = useMemo(
    () => prepareTimelineFields(data.series, options.mergeValues ?? true, timeRange, theme),
    [data.series, options.mergeValues, timeRange, theme]
  );

  const rowDisplayMode = options.rowDisplayMode ?? defaultOptions.rowDisplayMode ?? 'scroll';
  const isPaginationEnabled = rowDisplayMode === 'pagination';
  const { paginatedFrames, paginationRev, paginationElement, paginationHeight } = usePagination(
    frames,
    isPaginationEnabled ? options.perPage : undefined
  );
  const fixedTimelineHeight = useMemo(() => {
    if (!options.fixedRowHeight) {
      return undefined;
    }

    const rowCount = Math.max(
      1,
      paginatedFrames?.reduce((count, frame) => count + Math.max(0, frame.fields.length - 1), 0) ?? 0
    );

    return rowCount * options.fixedRowHeight + TIMELINE_CHART_FIXED_HEIGHT_PADDING;
  }, [options.fixedRowHeight, paginatedFrames]);
  const chartHeight = useMemo(() => {
    if (!fixedTimelineHeight) {
      return height - paginationHeight;
    }

    if (rowDisplayMode !== 'pagination') {
      return fixedTimelineHeight;
    }

    return Math.min(fixedTimelineHeight, height - (paginationHeight || PAGINATION_FOOTER_HEIGHT_FALLBACK));
  }, [fixedTimelineHeight, height, paginationHeight, rowDisplayMode]);

  useEffect(() => {
    if (!fixedTimelineHeight || rowDisplayMode !== 'auto') {
      return;
    }

    const updateHeight = () => {
      window.dispatchEvent(
        new CustomEvent(STATE_TIMELINE_AUTO_HEIGHT_EVENT, {
          detail: { id: panelId, height: fixedTimelineHeight + paginationHeight, panelHeight: height },
        })
      );
    };

    updateHeight();
    const animationFrame = requestAnimationFrame(updateHeight);
    const timeout = setTimeout(updateHeight, 250);

    return () => {
      window.dispatchEvent(new CustomEvent(STATE_TIMELINE_AUTO_HEIGHT_EVENT, { detail: { id: panelId, reset: true } }));
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeout);
    };
  }, [fixedTimelineHeight, height, paginationHeight, panelId, rowDisplayMode]);

  const legendItems = useMemo(
    () => prepareTimelineLegendItems(paginatedFrames, options.legend, theme),
    [paginatedFrames, options.legend, theme]
  );

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
  const fixedHeightContainerStyles = useMemo(() => {
    if (!fixedTimelineHeight) {
      return undefined;
    }

    if (rowDisplayMode === 'scroll') {
      return getFixedHeightContainerStyles(height, 'auto');
    }

    if (rowDisplayMode === 'auto') {
      return getFixedHeightContainerStyles(fixedTimelineHeight, 'hidden');
    }

    return undefined;
  }, [fixedTimelineHeight, height, rowDisplayMode]);

  if (!paginatedFrames || typeof warn === 'string') {
    return <PanelDataErrorView panelId={panelId} fieldConfig={fieldConfig} data={data} message={warn} needsTimeField />;
  }

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  return (
    <div className={cx(containerStyles, fixedHeightContainerStyles)}>
      <TimelineChart
        theme={theme}
        frames={paginatedFrames}
        structureRev={data.structureRev}
        paginationRev={paginationRev}
        timeRange={timeRange}
        timeZone={timezones}
        width={width}
        height={chartHeight}
        legendItems={legendItems}
        annotations={options.annotations}
        {...options}
        mode={TimelineMode.Changes}
        replaceVariables={replaceVariables}
        dataLinkPostProcessor={dataLinkPostProcessor}
        cursorSync={cursorSync}
        annotationLanes={options.annotations?.multiLane ? getXAnnotationFrames(data.annotations).length : undefined}
      >
        {(builder, alignedFrame) => {
          return (
            <>
              {cursorSync !== DashboardCursorSync.Off && (
                <EventBusPlugin config={builder} eventBus={eventBus} frame={alignedFrame} />
              )}
              <XAxisInteractionAreaPlugin config={builder} queryZoom={onChangeTimeRange} />
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
                      <StateTimelineTooltip
                        series={alignedFrame}
                        dataIdxs={dataIdxs}
                        seriesIdx={seriesIdx}
                        mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                        sortOrder={options.tooltip.sort}
                        isPinned={isPinned}
                        timeRange={timeRange}
                        annotate={enableAnnotationCreation ? annotate : undefined}
                        withDuration={true}
                        maxHeight={options.tooltip.maxHeight}
                        replaceVariables={replaceVariables}
                        dataLinks={dataLinks}
                        filterByGroupedLabels={getFilterByGroupedLabelsModel(alignedFrame, seriesIdx)}
                        canExecuteActions={userCanExecuteActions}
                      />
                    );
                  }}
                  maxWidth={options.tooltip.maxWidth}
                />
              )}
              {alignedFrame.fields[0].config.custom?.axisPlacement !== AxisPlacement.Hidden && (
                <AnnotationsPlugin
                  replaceVariables={replaceVariables}
                  options={options.annotations}
                  annotations={data.annotations}
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
