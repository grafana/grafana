import React, { useMemo, useState } from 'react';

import { PanelProps, DataFrameType, DashboardCursorSync } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode, VizOrientation } from '@grafana/schema';
import {
  EventBusPlugin,
  KeyboardPlugin,
  TooltipPlugin,
  TooltipPlugin2,
  usePanelContext,
  ZoomPlugin,
} from '@grafana/ui';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { config } from 'app/core/config';

import { TimeSeriesTooltip } from './TimeSeriesTooltip';
import { Options } from './panelcfg.gen';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { AnnotationsPlugin2 } from './plugins/AnnotationsPlugin2';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getTimezones, isTooltipScrollable, prepareGraphableFields } from './utils';

interface TimeSeriesPanelProps extends PanelProps<Options> {}

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
  const showNewVizTooltips = Boolean(config.featureToggles.newVizTooltips);
  // temp range set for adding new annotation set by TooltipPlugin2, consumed by AnnotationPlugin2
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
              <>
                {showNewVizTooltips ? (
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
                          frames={frames}
                          seriesFrame={alignedFrame}
                          dataIdxs={dataIdxs}
                          seriesIdx={seriesIdx}
                          mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                          sortOrder={options.tooltip.sort}
                          isPinned={isPinned}
                          annotate={enableAnnotationCreation ? annotate : undefined}
                          scrollable={isTooltipScrollable(options.tooltip)}
                        />
                      );
                    }}
                    maxWidth={options.tooltip.maxWidth}
                    maxHeight={options.tooltip.maxHeight}
                  />
                ) : (
                  <>
                    <ZoomPlugin config={uplotConfig} onZoom={onChangeTimeRange} withZoomY={true} />
                    <TooltipPlugin
                      frames={frames}
                      data={alignedFrame}
                      config={uplotConfig}
                      mode={options.tooltip.mode}
                      sortOrder={options.tooltip.sort}
                      sync={sync}
                      eventsScope={eventsScope}
                      timeZone={timeZone}
                    />
                  </>
                )}
              </>
            )}
            {/* Renders annotation markers*/}
            {!isVerticallyOriented && showNewVizTooltips ? (
              <AnnotationsPlugin2
                annotations={data.annotations ?? []}
                config={uplotConfig}
                timeZone={timeZone}
                newRange={newAnnotationRange}
                setNewRange={setNewAnnotationRange}
              />
            ) : (
              !isVerticallyOriented &&
              data.annotations && (
                <AnnotationsPlugin annotations={data.annotations} config={uplotConfig} timeZone={timeZone} />
              )
            )}

            {/*Enables annotations creation*/}
            {!showNewVizTooltips ? (
              enableAnnotationCreation && !isVerticallyOriented ? (
                <AnnotationEditorPlugin data={alignedFrame} timeZone={timeZone} config={uplotConfig}>
                  {({ startAnnotating }) => {
                    return (
                      <ContextMenuPlugin
                        data={alignedFrame}
                        config={uplotConfig}
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
              ) : (
                <ContextMenuPlugin
                  data={alignedFrame}
                  frames={frames}
                  config={uplotConfig}
                  timeZone={timeZone}
                  replaceVariables={replaceVariables}
                  defaultItems={[]}
                />
              )
            ) : undefined}
            {data.annotations && !isVerticallyOriented && (
              <ExemplarsPlugin
                visibleSeries={getVisibleLabels(uplotConfig, frames)}
                config={uplotConfig}
                exemplars={data.annotations}
                timeZone={timeZone}
              />
            )}

            {((canEditThresholds && onThresholdsChange) || showThresholds) && !isVerticallyOriented && (
              <ThresholdControlsPlugin
                config={uplotConfig}
                fieldConfig={fieldConfig}
                onThresholdsChange={canEditThresholds ? onThresholdsChange : undefined}
              />
            )}

            <OutsideRangePlugin config={uplotConfig} onChangeTimeRange={onChangeTimeRange} />
          </>
        );
      }}
    </TimeSeries>
  );
};
