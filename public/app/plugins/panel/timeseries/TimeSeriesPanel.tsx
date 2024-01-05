import React, { useMemo } from 'react';

import { PanelProps, DataFrameType, DashboardCursorSync } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { KeyboardPlugin, TooltipPlugin, TooltipPlugin2, usePanelContext, ZoomPlugin } from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { config } from 'app/core/config';

import { TimeSeriesTooltip } from './TimeSeriesTooltip';
import { Options } from './panelcfg.gen';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getTimezones, prepareGraphableFields, regenerateLinksSupplier } from './utils';

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
  const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, showThresholds, dataLinkPostProcessor } =
    usePanelContext();

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

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
  const showNewVizTooltips = config.featureToggles.newVizTooltips && sync && sync() === DashboardCursorSync.Off;

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
    >
      {(uplotConfig, alignedDataFrame) => {
        if (alignedDataFrame.fields.some((f) => Boolean(f.config.links?.length))) {
          alignedDataFrame = regenerateLinksSupplier(
            alignedDataFrame,
            frames,
            replaceVariables,
            timeZone,
            dataLinkPostProcessor
          );
        }

        return (
          <>
            <KeyboardPlugin config={uplotConfig} />
            {options.tooltip.mode === TooltipDisplayMode.None || (
              <>
                {showNewVizTooltips ? (
                  <TooltipPlugin2
                    config={uplotConfig}
                    hoverMode={
                      options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
                    }
                    queryZoom={onChangeTimeRange}
                    clientZoom={true}
                    render={(u, dataIdxs, seriesIdx, isPinned = false) => {
                      return (
                        <TimeSeriesTooltip
                          frames={frames}
                          seriesFrame={alignedDataFrame}
                          dataIdxs={dataIdxs}
                          seriesIdx={seriesIdx}
                          mode={options.tooltip.mode}
                          sortOrder={options.tooltip.sort}
                          isPinned={isPinned}
                        />
                      );
                    }}
                  />
                ) : (
                  <>
                    <ZoomPlugin config={uplotConfig} onZoom={onChangeTimeRange} withZoomY={true} />
                    <TooltipPlugin
                      frames={frames}
                      data={alignedDataFrame}
                      config={uplotConfig}
                      mode={options.tooltip.mode}
                      sortOrder={options.tooltip.sort}
                      sync={sync}
                      timeZone={timeZone}
                    />
                  </>
                )}
              </>
            )}
            {/* Renders annotation markers*/}
            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={uplotConfig} timeZone={timeZone} />
            )}
            {/*Enables annotations creation*/}
            {!showNewVizTooltips ? (
              enableAnnotationCreation ? (
                <AnnotationEditorPlugin data={alignedDataFrame} timeZone={timeZone} config={uplotConfig}>
                  {({ startAnnotating }) => {
                    return (
                      <ContextMenuPlugin
                        data={alignedDataFrame}
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
                  data={alignedDataFrame}
                  frames={frames}
                  config={uplotConfig}
                  timeZone={timeZone}
                  replaceVariables={replaceVariables}
                  defaultItems={[]}
                />
              )
            ) : undefined}
            {data.annotations && (
              <ExemplarsPlugin
                visibleSeries={getVisibleLabels(uplotConfig, frames)}
                config={uplotConfig}
                exemplars={data.annotations}
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

            <OutsideRangePlugin config={uplotConfig} onChangeTimeRange={onChangeTimeRange} />
          </>
        );
      }}
    </TimeSeries>
  );
};
