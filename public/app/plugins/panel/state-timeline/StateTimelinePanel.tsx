import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DashboardCursorSync, DataFrame, PanelProps } from '@grafana/data';
import {
  EventBusPlugin,
  Pagination,
  TooltipDisplayMode,
  TooltipPlugin2,
  usePanelContext,
  useTheme2,
} from '@grafana/ui';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import {
  prepareFieldsForPagination,
  prepareTimelineFields,
  prepareTimelineLegendItems,
  TimelineMode,
} from 'app/core/components/TimelineChart/utils';

import { AnnotationsPlugin2 } from '../timeseries/plugins/AnnotationsPlugin2';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { getTimezones } from '../timeseries/utils';

import { StateTimelineTooltip2 } from './StateTimelineTooltip2';
import { Options } from './panelcfg.gen';

interface TimelinePanelProps extends PanelProps<Options> {}

const styles = {
  container: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  paginationContainer: css({
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  }),
  paginationElement: css({
    marginTop: '8px',
  }),
};

function usePagination(frames?: DataFrame[], maxPageSize?: number) {
  const [pageNumber, setPageNumber] = useState(1);

  const { paginatedFrames, pageCount } = useMemo(() => {
    if (frames === undefined || maxPageSize === undefined || maxPageSize <= 0) {
      return { paginatedFrames: frames };
    }

    const normalizedFrames = prepareFieldsForPagination(frames);
    const pageCount = Math.ceil(normalizedFrames.length / maxPageSize);
    const pageOffset = (pageNumber - 1) * maxPageSize;
    const paginatedFrames = normalizedFrames.slice(pageOffset, pageOffset + maxPageSize);

    return { paginatedFrames, pageCount };
  }, [frames, pageNumber, maxPageSize]);

  // `paginationRev` needs to change value whenever any of the pagination settings changes.
  // It's used in to trigger a reconfiguration of the underlying graphs (which is cached,
  // hence an explicit nudge is required).
  const paginationRev = `${pageNumber}/${maxPageSize}`;

  const [paginationWrapperRef, { height: paginationWrapperHeight, width: paginationWrapperWidth }] =
    useMeasure<HTMLDivElement>();

  let paginationElement = undefined;
  if (pageCount !== undefined) {
    const showSmallVersion = paginationWrapperWidth < 550;
    paginationElement = (
      <div className={styles.paginationContainer} ref={paginationWrapperRef}>
        <Pagination
          className={styles.paginationElement}
          currentPage={pageNumber}
          numberOfPages={pageCount}
          showSmallVersion={showSmallVersion}
          onNavigate={setPageNumber}
        />
      </div>
    );
  }

  let paginationHeight = paginationWrapperHeight;
  if (paginationElement === undefined) {
    // `paginationElement` might be unmounted if "max page size" panel options is changed,
    // but `paginationWrapperHeight` won't reflect that, so an explicit handling is needed.
    paginationHeight = 0;
  }

  return { paginatedFrames, paginationRev, paginationElement, paginationHeight };
}

/**
 * @alpha
 */
export const StateTimelinePanel = ({
  data,
  timeRange,
  timeZone,
  options,
  width,
  height,
  replaceVariables,
  onChangeTimeRange,
}: TimelinePanelProps) => {
  const theme = useTheme2();

  // temp range set for adding new annotation set by TooltipPlugin2, consumed by AnnotationPlugin2
  const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);
  const { sync, eventsScope, canAddAnnotations, dataLinkPostProcessor, eventBus } = usePanelContext();
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  const { frames, warn } = useMemo(
    () => prepareTimelineFields(data.series, options.mergeValues ?? true, timeRange, theme),
    [data.series, options.mergeValues, timeRange, theme]
  );

  const { paginatedFrames, paginationRev, paginationElement, paginationHeight } = usePagination(
    frames,
    options.maxPageSize
  );

  const legendItems = useMemo(
    () => prepareTimelineLegendItems(paginatedFrames, options.legend, theme),
    [paginatedFrames, options.legend, theme]
  );

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);

  if (!paginatedFrames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  return (
    <div className={styles.container}>
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
        mode={TimelineMode.Changes}
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
                      />
                    );
                  }}
                  maxWidth={options.tooltip.maxWidth}
                />
              )}
              {/* Renders annotations */}
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
      {paginationElement}
    </div>
  );
};
