import React, { useCallback, useMemo, useRef } from 'react';
import { DataFrame, EventBus, Field, FieldMatcherID, fieldMatchers, PanelProps, TimeRange } from '@grafana/data';
import {
  UPlotChart2,
  preparePlotFrame,
  useTheme2,
  VizLayout,
  PlotLegend,
  LegendDisplayMode,
  ZoomPlugin,
  TooltipPlugin,
  usePanelContext,
} from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { TimeSeriesOptions } from './types';
import { prepareGraphableFields } from './utils';
import { config } from 'app/core/config';
import { PanelDataErrorView } from '@grafana/runtime';
import { preparePlotConfigBuilder } from '@grafana/ui/src/components/TimeSeries/utils';
import { debugLog } from '@grafana/ui/src/components/uPlotChart/debug';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';

interface TimeSeriesPanelProps extends PanelProps<TimeSeriesOptions> {}

export const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({
  data,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
  id,
  timeZone,
  ...otherProps
}) => {
  const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, onSplitOpen } = usePanelContext();
  const theme = useTheme2();
  const timeRange = useRef<TimeRange>();
  const eventBus = useRef<EventBus>();
  const series = useRef<DataFrame[]>();

  timeRange.current = otherProps.timeRange;
  eventBus.current = otherProps.eventBus;
  series.current = data.series;

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: timeRange.current! });
  };

  const frames = useMemo(() => prepareGraphableFields(data.series, config.theme2), [data]);

  const cfg = useMemo(() => {
    debugLog('TimeSeriesPanel.preparePlotConfigBuilder memo');

    const alignedFrame = preparePlotFrame(series.current!, {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    });

    return preparePlotConfigBuilder({
      allFrames: series.current!,
      frame: alignedFrame!,
      timeZone: timeZone,
      eventBus: eventBus.current!,
      theme,
      getTimeRange: () => timeRange.current!,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, timeZone, theme]); //, options.legend, options.tooltip

  const plotData = useMemo(() => {
    if (!cfg) {
      return null;
    }

    return cfg.prepData({
      frames: data.series,
    });
  }, [cfg, data]);

  const renderLegend = useCallback(() => {
    const { legend } = options;

    if (!frames || !cfg || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return null;
    }

    return <PlotLegend data={frames} config={cfg?.builder} {...legend} />;
  }, [options, frames, cfg]);

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  if (!frames) {
    return <PanelDataErrorView panelId={id} data={data} needsTimeField={true} needsNumberField={true} />;
  }

  if (!plotData || !cfg) {
    return null;
  }

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart2 config={cfg} data={plotData.aligned} width={vizWidth} height={vizHeight}>
            {(cfg, u) => {
              return (
                <>
                  <ZoomPlugin config={cfg.builder} onZoom={onChangeTimeRange} />
                  <TooltipPlugin
                    data={plotData.alignedFrame}
                    config={cfg.builder}
                    mode={options.tooltip.mode}
                    sortOrder={options.tooltip.sort}
                    sync={sync}
                    timeZone={timeZone}
                  />

                  {data.annotations && (
                    <AnnotationsPlugin annotations={data.annotations} config={cfg.builder} timeZone={timeZone} />
                  )}

                  {/* Enables annotations creation*/}
                  {enableAnnotationCreation ? (
                    <AnnotationEditorPlugin data={plotData.alignedFrame} timeZone={timeZone} config={cfg.builder}>
                      {({ startAnnotating }) => {
                        return (
                          <ContextMenuPlugin
                            data={plotData.alignedFrame}
                            config={cfg.builder}
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
                      data={plotData.alignedFrame}
                      config={cfg.builder}
                      timeZone={timeZone}
                      replaceVariables={replaceVariables}
                      defaultItems={[]}
                    />
                  )}
                  {data.annotations && (
                    <ExemplarsPlugin
                      config={cfg.builder}
                      exemplars={data.annotations}
                      timeZone={timeZone}
                      getFieldLinks={getFieldLinks}
                    />
                  )}

                  {canEditThresholds && onThresholdsChange && (
                    <ThresholdControlsPlugin
                      config={cfg.builder}
                      fieldConfig={fieldConfig}
                      onThresholdsChange={onThresholdsChange}
                    />
                  )}
                </>
              );
            }}
          </UPlotChart2>
        )}
      </VizLayout>
    </>
  );
};
