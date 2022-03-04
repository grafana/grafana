import React, { useCallback, useMemo, useRef, useState } from 'react';
import { DataFrame, Field, PanelProps } from '@grafana/data';
import {
  UPlotChart2,
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
import { preparePlotData } from '@grafana/ui/src/components/uPlot/utils';
import { PrepDataFnResult, UPlotConfigContext } from '@grafana/ui/src/components/uPlot/config/UPlotConfigBuilder';
import { AlignedData } from 'uplot';

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

  const configContext = useRef<
    UPlotConfigContext<{
      alignedFrame: DataFrame | null;
      aligned: AlignedData | null;
    }>
  >();

  const [dataErrors, setDataErrors] = useState<any>();

  // Responsible for data validation and preparation
  const plotData = useMemo(() => {
    debugLog('TimeSeriesPanel.plotData memo');
    const result = prepareTimeSeriesPlotData(data.series);

    if (result.error) {
      setDataErrors(result.error);
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, timeZone, data, setDataErrors]);

  configContext.current = {
    timeRange: otherProps.timeRange,
    data: plotData,
    eventBus: otherProps.eventBus,
  };

  const plotConfig = useMemo(() => {
    debugLog('TimeSeriesPanel.plotConfig memo');

    if (!configContext.current?.data.frames || !configContext.current?.data.alignedFrame) {
      return null;
    }

    return preparePlotConfigBuilder(
      {
        allFrames: configContext.current.data.frames,
        frame: configContext.current.data.alignedFrame,
        timeZone: timeZone,
        theme,
      },
      configContext.current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, timeZone, theme]);

  const renderLegend = useCallback(() => {
    const { legend } = options;

    if (!frames || !plotConfig || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return null;
    }

    return <PlotLegend data={plotData!.frames} config={plotConfig?.builder} {...legend} />;
  }, [options, plotData, plotConfig]);

  if (dataErrors) {
    return <PanelDataErrorView panelId={id} data={data} needsTimeField={true} needsNumberField={true} />;
  }

  if (!plotData || !plotConfig) {
    return null;
  }

  plotConfig.setCtx({ timeRange: otherProps.timeRange, data: plotData, eventBus: otherProps.eventBus });

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: otherProps.timeRange });
  };

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart2 config={plotConfig} data={plotData.aligned!} width={vizWidth} height={vizHeight}>
            {(plotConfig) => {
              return (
                <>
                  <ZoomPlugin config={plotConfig.builder} onZoom={onChangeTimeRange} />
                  <TooltipPlugin
                    data={plotData.alignedFrame!}
                    config={plotConfig.builder}
                    mode={options.tooltip.mode}
                    sortOrder={options.tooltip.sort}
                    sync={sync}
                    timeZone={timeZone}
                  />

                  {data.annotations && (
                    <AnnotationsPlugin annotations={data.annotations} config={plotConfig.builder} timeZone={timeZone} />
                  )}

                  {/* Enables annotations creation*/}
                  {enableAnnotationCreation ? (
                    <AnnotationEditorPlugin
                      data={plotData.alignedFrame!}
                      timeZone={timeZone}
                      config={plotConfig.builder}
                    >
                      {({ startAnnotating }) => {
                        return (
                          <ContextMenuPlugin
                            data={plotData.alignedFrame!}
                            config={plotConfig.builder}
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
                      data={plotData.alignedFrame!}
                      config={plotConfig.builder}
                      timeZone={timeZone}
                      replaceVariables={replaceVariables}
                      defaultItems={[]}
                    />
                  )}
                  {data.annotations && (
                    <ExemplarsPlugin
                      config={plotConfig.builder}
                      exemplars={data.annotations}
                      timeZone={timeZone}
                      getFieldLinks={getFieldLinks}
                    />
                  )}

                  {canEditThresholds && onThresholdsChange && (
                    <ThresholdControlsPlugin
                      config={plotConfig.builder}
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

const prepareTimeSeriesPlotData = (
  data: DataFrame[]
): PrepDataFnResult<{ alignedFrame: DataFrame | null; aligned: AlignedData | null }> => {
  const frames = prepareGraphableFields(data, config.theme2);

  if (!frames) {
    return {
      error: 'No time field found',
      frames: data,
      alignedFrame: null,
      aligned: null,
    };
  }

  return preparePlotData({
    frames,
  });
};
