import React, { useCallback, useMemo } from 'react';

import { DataFrame, FieldType, PanelProps } from '@grafana/data';
import { TooltipPlugin, useTheme2, ZoomPlugin, usePanelContext } from '@grafana/ui';
import { getLastStreamingDataFramePacket } from 'app/features/live/data/StreamingDataFrame';

import { AnnotationEditorPlugin } from '../timeseries/plugins/AnnotationEditorPlugin';
import { AnnotationsPlugin } from '../timeseries/plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from '../timeseries/plugins/ContextMenuPlugin';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { getTimezones } from '../timeseries/utils';

import { StateTimelineTooltip } from './StateTimelineTooltip';
import { TimelineChart } from './TimelineChart';
import { TimelineMode, TimelineOptions } from './types';
import { prepareTimelineFields, prepareTimelineLegendItems } from './utils';

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
  replaceVariables,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();
  const { sync, canAddAnnotations } = usePanelContext();

  const { frames, warn } = useMemo(
    () => prepareTimelineFields(data?.series, options.mergeValues ?? true, timeRange, theme),
    [data, options.mergeValues, timeRange, theme]
  );

  const legendItems = useMemo(
    () => prepareTimelineLegendItems(frames, options.legend, theme),
    [frames, options.legend, theme]
  );

  const timezones = useMemo(() => getTimezones(options.timezones, timeZone), [options.timezones, timeZone]);

  const renderCustomTooltip = useCallback(
    (alignedData: DataFrame, seriesIdx: number | null, datapointIdx: number | null) => {
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
        <StateTimelineTooltip
          data={data}
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
      timeZones={timezones}
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
              sync={sync}
              config={config}
              mode={options.tooltip.mode}
              timeZone={timeZone}
              renderTooltip={renderCustomTooltip}
            />
            <OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />

            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}

            {enableAnnotationCreation && (
              <AnnotationEditorPlugin data={alignedFrame} timeZone={timeZone} config={config}>
                {({ startAnnotating }) => {
                  return (
                    <ContextMenuPlugin
                      data={alignedFrame}
                      config={config}
                      timeZone={timeZone}
                      replaceVariables={replaceVariables}
                      defaultItems={[
                        {
                          items: [
                            {
                              label: 'Add annotation',
                              ariaLabel: 'Add annotation',
                              icon: 'comment-alt',
                              onClick: (e, p) => {
                                if (!p) {
                                  return;
                                }
                                startAnnotating({ coords: p.coords });
                              },
                            },
                          ],
                        },
                      ]}
                    />
                  );
                }}
              </AnnotationEditorPlugin>
            )}
          </>
        );
      }}
    </TimelineChart>
  );
};
