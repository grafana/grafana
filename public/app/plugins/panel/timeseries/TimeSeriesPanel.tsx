import { useMemo, useState, useEffect } from 'react';

import { PanelProps, DataFrameType, DashboardCursorSync, DataFrame, Field, FieldType } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode, VizOrientation } from '@grafana/schema';
import { EventBusPlugin, KeyboardPlugin, TooltipPlugin2, usePanelContext } from '@grafana/ui';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { config } from 'app/core/config';

import { TimeSeriesTooltip } from './TimeSeriesTooltip';
import { Options } from './panelcfg.gen';
import { AnnotationsPlugin2 } from './plugins/AnnotationsPlugin2';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getTimezones, prepareGraphableFields } from './utils';

interface CustomAnnotation {
  timestamp: number;
  text: string;
  color?: string;
}

interface TimeSeriesPanelProps extends PanelProps<Options> { }

export const TimeSeriesPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
  id,
}: TimeSeriesPanelProps) => {
  const {
    sync,
    eventsScope,
    canAddAnnotations,
    onThresholdsChange,
    canEditThresholds,
    showThresholds,
    dataLinkPostProcessor,
    eventBus,
  } = usePanelContext();

  const [customAnnotations, setCustomAnnotations] = useState<DataFrame[]>([]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const annotationsParam = searchParams.get('customAnnotations');
    if (annotationsParam) {
      try {
        const parsedAnnotations = JSON.parse(annotationsParam) as CustomAnnotation[];
        // Convert custom annotations to DataFrame format
        const annotationFrames = parsedAnnotations.map(annotation => {
          const timeField: Field = {
            name: 'time',
            type: FieldType.time,
            values: [annotation.timestamp],
            config: {},
          };

          const textField: Field = {
            name: 'text',
            type: FieldType.string,
            values: [annotation.text],
            config: {},
          };

          const fields = [timeField, textField];
          if (annotation.color) {
            const colorField: Field = {
              name: 'color',
              type: FieldType.string,
              values: [annotation.color ?? ''],
              config: {},
            };

            fields.push(colorField);
          }

          return {
            fields: fields,
            length: 1,
            meta: {
              type: DataFrameType.TimeSeriesMulti,
            },
          };
        });

        setCustomAnnotations(annotationFrames);
      } catch (e) {
        console.error('Failed to parse annotations from URL:', e);
      }
    }
  }, []);

  // Vertical orientation is not available for users through config.
  // It is simplified version of horizontal time series panel and it does not support all plugins.
  const isVerticallyOriented = options.orientation === VizOrientation.Vertical;
  const frames = useMemo(() => prepareGraphableFields(data.series, config.theme2, timeRange), [data.series, timeRange]);
  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
  const suggestions = useMemo(() => {
    if (frames?.length && frames.every((df) => df.meta?.type === DataFrameType.TimeSeriesLong)) {
      const s = getPrepareTimeseriesSuggestion(id);
      return {
        message: 'Long data must be converted to wide',
        suggestions: s ? [s] : undefined,
      };
    }
    return undefined;
  }, [frames, id]);

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
  const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  if (!frames || suggestions) {
    return (
      <PanelDataErrorView
        panelId={id}
        message={suggestions?.message}
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={true}
        needsNumberField={true}
        suggestions={suggestions?.suggestions}
      />
    );
  }

  // Combine dashboard annotations with custom annotations from URL
  const allAnnotations = [...(data.annotations ?? []), ...customAnnotations];

  return (
    <TimeSeries
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timezones}
      width={width}
      height={height}
      legend={options.legend}
      options={options}
      replaceVariables={replaceVariables}
      dataLinkPostProcessor={dataLinkPostProcessor}
      cursorSync={cursorSync}
    >
      {(uplotConfig, alignedFrame) => {
        return (
          <>
            <KeyboardPlugin config={uplotConfig} />
            {cursorSync !== DashboardCursorSync.Off && (
              <EventBusPlugin config={uplotConfig} eventBus={eventBus} frame={alignedFrame} />
            )}
            {options.tooltip.mode !== TooltipDisplayMode.None && (
              <TooltipPlugin2
                config={uplotConfig}
                hoverMode={
                  options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
                }
                queryZoom={onChangeTimeRange}
                clientZoom={true}
                syncMode={cursorSync}
                syncScope={eventsScope}
                render={(u, dataIdxs, seriesIdx, isPinned = false, dismiss, timeRange2, viaSync) => {
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
                    // not sure it header time here works for annotations, since it's taken from nearest datapoint index
                    <TimeSeriesTooltip
                      series={alignedFrame}
                      dataIdxs={dataIdxs}
                      seriesIdx={seriesIdx}
                      mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                      sortOrder={options.tooltip.sort}
                      isPinned={isPinned}
                      annotate={enableAnnotationCreation ? annotate : undefined}
                      maxHeight={options.tooltip.maxHeight}
                      replaceVariables={replaceVariables}
                    />
                  );
                }}
                maxWidth={options.tooltip.maxWidth}
              />
            )}
            {!isVerticallyOriented && (
              <>
                <AnnotationsPlugin2
                  annotations={allAnnotations}
                  config={uplotConfig}
                  timeZone={timeZone}
                  newRange={newAnnotationRange}
                  setNewRange={setNewAnnotationRange}
                />
                <OutsideRangePlugin config={uplotConfig} onChangeTimeRange={onChangeTimeRange} />
                {allAnnotations.length > 0 && (
                  <ExemplarsPlugin
                    visibleSeries={getVisibleLabels(uplotConfig, frames)}
                    config={uplotConfig}
                    exemplars={allAnnotations}
                    timeZone={timeZone}
                  />
                )}
                {((canEditThresholds && onThresholdsChange) || showThresholds) && (
                  <ThresholdControlsPlugin
                    config={uplotConfig}
                    fieldConfig={fieldConfig}
                    onThresholdsChange={canEditThresholds ? onThresholdsChange : undefined}
                  />
                )}
              </>
            )}
          </>
        );
      }}
    </TimeSeries>
  );
};
