import React, { useCallback, useMemo, useRef, useState } from 'react';

import { CartesianCoords2D, DashboardCursorSync, DataFrame, FieldType, PanelProps } from '@grafana/data';
import {
  Portal,
  TooltipDisplayMode,
  UPlotConfigBuilder,
  usePanelContext,
  useTheme2,
  VizTooltipContainer,
  ZoomPlugin,
} from '@grafana/ui';
import { HoverEvent, addTooltipSupport } from '@grafana/ui/src/components/uPlot/config/addTooltipSupport';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import {
  prepareTimelineFields,
  prepareTimelineLegendItems,
  TimelineMode,
} from 'app/core/components/TimelineChart/utils';
import { getLastStreamingDataFramePacket } from 'app/features/live/data/StreamingDataFrame';

import { AnnotationEditorPlugin } from '../timeseries/plugins/AnnotationEditorPlugin';
import { AnnotationsPlugin } from '../timeseries/plugins/AnnotationsPlugin';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { getTimezones } from '../timeseries/utils';

import { StateTimelineTooltip } from './StateTimelineTooltip';
import { PanelOptions } from './panelcfg.gen';

const TOOLTIP_OFFSET = 10;

interface TimelinePanelProps extends PanelProps<PanelOptions> {}

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
  replaceVariables,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();

  const oldConfig = useRef<UPlotConfigBuilder | undefined>(undefined);
  const isToolTipOpen = useRef<boolean>(false);

  const [hover, setHover] = useState<HoverEvent | undefined>(undefined);
  const [coords, setCoords] = useState<{ viewport: CartesianCoords2D; canvas: CartesianCoords2D } | null>(null);
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);
  const { sync, canAddAnnotations } = usePanelContext();

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setCoords(null);
    setShouldDisplayCloseButton(false);
  };

  const onUPlotClick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;
    // Linking into useState required to re-render tooltip
    setShouldDisplayCloseButton(isToolTipOpen.current);
  };

  const { frames, warn } = useMemo(
    () => prepareTimelineFields(data?.series, options.mergeValues ?? true, timeRange, theme),
    [data, options.mergeValues, timeRange, theme]
  );

  const legendItems = useMemo(
    () => prepareTimelineLegendItems(frames, options.legend, theme),
    [frames, options.legend, theme]
  );

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);

  const renderCustomTooltip = useCallback(
    (alignedData: DataFrame, seriesIdx: number | null, datapointIdx: number | null, onAnnotationAdd?: () => void) => {
      const data = frames ?? [];
      // Count value fields in the state-timeline-ready frame
      const valueFieldsCount = data.reduce(
        (acc, frame) => acc + frame.fields.filter((field) => field.type !== FieldType.time).length,
        0
      );

      // Not caring about multi mode in StateTimeline
      if (seriesIdx === null || datapointIdx === null) {
        return null;
      }

      /**
       * There could be a case when the tooltip shows a data from one of a multiple query and the other query finishes first
       * from refreshing. This causes data to be out of sync. alignedData - 1 because Time field doesn't count.
       * Render nothing in this case to prevent error.
       * See https://github.com/grafana/support-escalations/issues/932
       */
      if (
        (!alignedData.meta?.transformations?.length && alignedData.fields.length - 1 !== valueFieldsCount) ||
        !alignedData.fields[seriesIdx]
      ) {
        return null;
      }

      return (
        <>
          {shouldDisplayCloseButton && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <CloseButton
                onClick={onCloseToolTip}
                style={{
                  position: 'relative',
                  top: 'auto',
                  right: 'auto',
                  marginRight: 0,
                }}
              />
            </div>
          )}
          <StateTimelineTooltip
            data={data}
            alignedData={alignedData}
            seriesIdx={seriesIdx}
            datapointIdx={datapointIdx}
            timeZone={timeZone}
            onAnnotationAdd={onAnnotationAdd}
          />
        </>
      );
    },
    [timeZone, frames, shouldDisplayCloseButton]
  );

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  if (frames.length === 1) {
    const packet = getLastStreamingDataFramePacket(frames[0]);
    if (packet) {
      // console.log('STREAM Packet', packet);
    }
  }
  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

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
      mode={TimelineMode.Changes}
    >
      {(config, alignedFrame) => {
        if (oldConfig.current !== config) {
          oldConfig.current = addTooltipSupport({
            config,
            onUPlotClick,
            setFocusedSeriesIdx,
            setFocusedPointIdx,
            setCoords,
            setHover,
            isToolTipOpen,
            isActive,
            setIsActive,
            sync,
          });
        }

        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />

            <OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />

            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}

            {enableAnnotationCreation ? (
              <AnnotationEditorPlugin data={alignedFrame} timeZone={timeZone} config={config}>
                {({ startAnnotating }) => {
                  if (options.tooltip.mode === TooltipDisplayMode.None) {
                    return null;
                  }

                  if (focusedPointIdx === null || (!isActive && sync && sync() === DashboardCursorSync.Crosshair)) {
                    return null;
                  }

                  return (
                    <Portal>
                      {hover && coords && focusedSeriesIdx && (
                        <VizTooltipContainer
                          position={{ x: coords.viewport.x, y: coords.viewport.y }}
                          offset={{ x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }}
                          allowPointerEvents={isToolTipOpen.current}
                        >
                          {renderCustomTooltip(alignedFrame, focusedSeriesIdx, focusedPointIdx, () => {
                            startAnnotating({ coords: { plotCanvas: coords.canvas, viewport: coords.viewport } });
                            onCloseToolTip();
                          })}
                        </VizTooltipContainer>
                      )}
                    </Portal>
                  );
                }}
              </AnnotationEditorPlugin>
            ) : (
              <Portal>
                {options.tooltip.mode !== TooltipDisplayMode.None && hover && coords && (
                  <VizTooltipContainer
                    position={{ x: coords.viewport.x, y: coords.viewport.y }}
                    offset={{ x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }}
                    allowPointerEvents={isToolTipOpen.current}
                  >
                    {renderCustomTooltip(alignedFrame, focusedSeriesIdx, focusedPointIdx)}
                  </VizTooltipContainer>
                )}
              </Portal>
            )}
          </>
        );
      }}
    </TimelineChart>
  );
};
