import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  arrayUtils,
  DataFrame,
  EventBus,
  FALLBACK_COLOR,
  Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  PanelProps,
  TimeRange,
} from '@grafana/data';
import {
  UPlotChart2,
  useTheme2,
  VizLayout,
  PlotLegend,
  LegendDisplayMode,
  ZoomPlugin,
  usePanelContext,
  UPlotCursorPlugin,
  VizTooltipContainer,
  TooltipDisplayMode,
  SeriesTable,
  SeriesTableRowProps,
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
import { PrepDataFnResult, UPlotChartEvent } from '@grafana/ui/src/components/uPlot/config/UPlotConfigBuilder';
import { AlignedData } from 'uplot';
import { SortOrder } from '@grafana/schema';

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
  const alignedFrame = useRef<DataFrame | null>(null);
  const [dataErrors, setDataErrors] = useState<any>();

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  timeRange.current = otherProps.timeRange;
  eventBus.current = otherProps.eventBus;
  series.current = data.series;

  // Responsible for data validation and preparation
  const plotData = useMemo(() => {
    debugLog('TimeSeriesPanel.plotData memo');
    const result = prepareTimeSeriesPlotData(data.series);

    if (result.error) {
      setDataErrors(result.error);
    }
    // Storing aligned frame via ref to avoid unnecessary config invalidation
    alignedFrame.current = result.alignedFrame;

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, timeZone, data, setDataErrors]);

  const plotConfig = useMemo(() => {
    debugLog('TimeSeriesPanel.plotConfig memo');

    if (!series.current || !alignedFrame.current) {
      return null;
    }

    return preparePlotConfigBuilder({
      allFrames: series.current,
      frame: alignedFrame.current,
      timeZone: timeZone,
      eventBus: eventBus.current!,
      theme,
      getTimeRange: () => timeRange.current!,
      sync,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.structureRev, timeZone, theme]);

  const renderLegend = useCallback(() => {
    const { legend } = options;

    if (!frames || !plotConfig || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return null;
    }

    return <PlotLegend data={plotData!.frames} config={plotConfig?.builder} {...legend} />;
  }, [options, plotData, plotConfig]);

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: timeRange.current! });
  };

  if (dataErrors) {
    return <PanelDataErrorView panelId={id} data={data} needsTimeField={true} needsNumberField={true} />;
  }

  if (!plotData || !plotConfig) {
    return null;
  }

  const renderTooltip = (e: UPlotChartEvent) => {
    if (!alignedFrame.current) {
      return null;
    }

    let xField = alignedFrame.current.fields[0];
    if (!xField) {
      return null;
    }

    const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

    let tooltip;
    if (options.tooltip.mode === TooltipDisplayMode.Single && e.seriesIdx != null) {
      const field = alignedFrame.current?.fields[e.seriesIdx];
      const dataIdx = e.dataIdxs[e.seriesIdx];

      if (!field || dataIdx == null) {
        return null;
      }

      const xVal = xFieldFmt(xField!.values.get(dataIdx)).text;
      const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
      const display = fieldFmt(field.values.get(dataIdx));

      tooltip = (
        <SeriesTable
          series={[
            {
              color: display.color || FALLBACK_COLOR,
              label: getFieldDisplayName(field, alignedFrame.current),
              value: display ? formattedValueToString(display) : null,
            },
          ]}
          timestamp={xVal}
        />
      );
    } else if (options.tooltip.mode === TooltipDisplayMode.Multi) {
      let series: SeriesTableRowProps[] = [];
      const frame = alignedFrame.current;
      const fields = frame.fields;
      const sortIdx: Array<[number, number]> = [];
      const dataIdx = e.dataIdxs[0];
      if (!dataIdx) {
        return null;
      }
      const xVal = xFieldFmt(xField!.values.get(dataIdx)).text;

      for (let i = 1; i < fields.length; i++) {
        const dataIdx = e.dataIdxs[0];
        const field = frame.fields[i];

        if (
          !field ||
          field.type !== FieldType.number ||
          field.config.custom?.hideFrom?.tooltip ||
          field.config.custom?.hideFrom?.viz
        ) {
          continue;
        }

        const v = alignedFrame.current.fields[i].values.get(dataIdx!);
        const display = field.display!(v);

        sortIdx.push([series.length, v]);
        series.push({
          color: display.color || FALLBACK_COLOR,
          label: getFieldDisplayName(field, frame),
          value: display ? formattedValueToString(display) : null,
          isActive: e.seriesIdx === i,
        });
      }

      if (options.tooltip.sort !== SortOrder.None) {
        series.sort((a, b) => arrayUtils.sortValues(options.tooltip.sort as any)(a.value, b.value));
      }

      tooltip = <SeriesTable series={[...series]} timestamp={xVal} />;
    }

    if (!tooltip) {
      return null;
    }

    return (
      <VizTooltipContainer
        position={{ x: e.x, y: e.y }}
        offset={{ x: 10, y: 10 }}
        // allowPointerEvents={isToolTipOpen.current}
      >
        {tooltip}
      </VizTooltipContainer>
    );
  };

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart2 config={plotConfig} data={plotData.aligned!} width={vizWidth} height={vizHeight}>
            {(plotConfig) => {
              return (
                <>
                  <UPlotCursorPlugin config={plotConfig}>
                    {(e) => {
                      if (!e || e.x == null || e.y == null) {
                        return null;
                      }

                      return renderTooltip(e);
                    }}
                  </UPlotCursorPlugin>

                  <ZoomPlugin config={plotConfig.builder} onZoom={onChangeTimeRange} />

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
