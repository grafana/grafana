// this file is pretty much a copy-paste of TimeSeriesPanel.tsx :(
// with some extra renderers passed to the <TimeSeries> component

import React, { useMemo } from 'react';
import uPlot from 'uplot';

import { Field, getDisplayProcessor, getLinksSupplier, PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { TimeSeries, TooltipPlugin, UPlotConfigBuilder, usePanelContext, useTheme2, ZoomPlugin } from '@grafana/ui';
import { AxisProps } from '@grafana/ui/src/components/uPlot/config/UPlotAxisBuilder';
import { ScaleProps } from '@grafana/ui/src/components/uPlot/config/UPlotScaleBuilder';
import { config } from 'app/core/config';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';

import { AnnotationEditorPlugin } from '../timeseries/plugins/AnnotationEditorPlugin';
import { AnnotationsPlugin } from '../timeseries/plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from '../timeseries/plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from '../timeseries/plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from '../timeseries/plugins/ThresholdControlsPlugin';

import { prepareCandlestickFields } from './fields';
import { PanelOptions, defaultCandlestickColors, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers, FieldIndices } from './utils';

interface CandlestickPanelProps extends PanelProps<PanelOptions> {}

export const CandlestickPanel = ({
  data,
  id,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
}: CandlestickPanelProps) => {
  const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, showThresholds, onSplitOpen } =
    usePanelContext();

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
  };

  const theme = useTheme2();

  const info = useMemo(() => {
    return prepareCandlestickFields(data.series, options, theme, timeRange);
  }, [data, options, theme, timeRange]);

  const { renderers, tweakScale, tweakAxis, shouldRenderPrice } = useMemo(() => {
    let tweakScale = (opts: ScaleProps, forField: Field) => opts;
    let tweakAxis = (opts: AxisProps, forField: Field) => opts;

    let doNothing = {
      renderers: [],
      tweakScale,
      tweakAxis,
      shouldRenderPrice: false,
    };

    if (!info) {
      return doNothing;
    }

    // Un-encoding the already parsed special fields
    // This takes currently matched fields and saves the name so they can be looked up by name later
    // ¯\_(ツ)_/¯  someday this can make more sense!
    const fieldMap = info.names;

    if (!Object.keys(fieldMap).length) {
      return doNothing;
    }

    const { mode, candleStyle, colorStrategy } = options;
    const colors = { ...defaultCandlestickColors, ...options.colors };
    let { open, high, low, close, volume } = fieldMap; // names from matched fields

    if (open == null || close == null) {
      return doNothing;
    }

    let volumeAlpha = 0.5;

    let volumeIdx = -1;

    let shouldRenderVolume = false;

    // find volume field and set overrides
    if (volume != null && mode !== VizDisplayMode.Candles) {
      let volumeField = info.volume!;

      if (volumeField != null) {
        shouldRenderVolume = true;

        let { fillOpacity } = volumeField.config.custom;

        if (fillOpacity) {
          volumeAlpha = fillOpacity / 100;
        }

        // we only want to put volume on own shorter axis when rendered with price
        if (mode !== VizDisplayMode.Volume) {
          volumeField.config = { ...volumeField.config };
          volumeField.config.unit = 'short';
          volumeField.display = getDisplayProcessor({
            field: volumeField,
            theme: config.theme2,
          });

          tweakAxis = (opts: AxisProps, forField: Field) => {
            // we can't do forField === info.volume because of copies :(
            if (forField.name === info.volume?.name) {
              let filter = (u: uPlot, splits: number[]) => {
                let _splits = [];
                let max = u.series[volumeIdx].max as number;

                for (let i = 0; i < splits.length; i++) {
                  _splits.push(splits[i]);

                  if (splits[i] > max) {
                    break;
                  }
                }

                return _splits;
              };

              opts.space = 20; // reduce tick spacing
              opts.filter = filter; // hide tick labels
              opts.ticks = { ...opts.ticks, filter }; // hide tick marks
            }

            return opts;
          };

          tweakScale = (opts: ScaleProps, forField: Field) => {
            // we can't do forField === info.volume because of copies :(
            if (forField.name === info.volume?.name) {
              opts.range = (u: uPlot, min: number, max: number) => [0, max * 7];
            }

            return opts;
          };
        }
      }
    }

    let shouldRenderPrice = mode !== VizDisplayMode.Volume && high != null && low != null;

    if (!shouldRenderPrice && !shouldRenderVolume) {
      return doNothing;
    }

    let fields: Record<string, string> = {};
    let indicesOnly = [];

    if (shouldRenderPrice) {
      fields = { open, high: high!, low: low!, close };
    } else {
      // these fields should not be omitted from normal rendering if they arent rendered
      // as part of price markers. they're only here so we can get back their indicies in the
      // init callback below. TODO: remove this when field mapping happens in the panel instead of deep
      indicesOnly.push(open, close);
    }

    if (shouldRenderVolume) {
      fields.volume = volume!;
      fields.open = open;
      fields.close = close;
    }

    return {
      shouldRenderPrice,
      renderers: [
        {
          fieldMap: fields,
          indicesOnly,
          init: (builder: UPlotConfigBuilder, fieldIndices: FieldIndices) => {
            volumeIdx = fieldIndices.volume!;

            builder.addHook(
              'drawAxes',
              drawMarkers({
                mode,
                fields: fieldIndices,
                upColor: config.theme2.visualization.getColorByName(colors.up),
                downColor: config.theme2.visualization.getColorByName(colors.down),
                flatColor: config.theme2.visualization.getColorByName(colors.flat),
                volumeAlpha,
                colorStrategy,
                candleStyle,
                flatAsUp: true,
              })
            );
          },
        },
      ],
      tweakScale,
      tweakAxis,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev, data.series.length]);

  if (!info) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={true}
        needsNumberField={true}
      />
    );
  }

  if (shouldRenderPrice) {
    // hide series from legend that are rendered as composite markers
    for (let key in renderers[0].fieldMap) {
      let field = (info as any)[key] as Field;
      field.config = {
        ...field.config,
        custom: {
          ...field.config.custom,
          hideFrom: { legend: true, tooltip: false, viz: false },
        },
      };
    }
  }

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  return (
    <TimeSeries
      frames={[info.frame]}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      renderers={renderers}
      tweakAxis={tweakAxis}
      tweakScale={tweakScale}
      options={options}
    >
      {(config, alignedDataFrame) => {
        alignedDataFrame.fields.forEach((field) => {
          field.getLinks = getLinksSupplier(
            alignedDataFrame,
            field,
            field.state!.scopedVars!,
            replaceVariables,
            timeZone
          );
        });

        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            <TooltipPlugin
              data={alignedDataFrame}
              config={config}
              mode={TooltipDisplayMode.Multi}
              sync={sync}
              timeZone={timeZone}
            />
            {/* Renders annotation markers*/}
            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}
            {/* Enables annotations creation*/}
            {enableAnnotationCreation ? (
              <AnnotationEditorPlugin data={alignedDataFrame} timeZone={timeZone} config={config}>
                {({ startAnnotating }) => {
                  return (
                    <ContextMenuPlugin
                      data={alignedDataFrame}
                      config={config}
                      timeZone={timeZone}
                      replaceVariables={replaceVariables}
                      defaultItems={
                        enableAnnotationCreation
                          ? [
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
                            ]
                          : []
                      }
                    />
                  );
                }}
              </AnnotationEditorPlugin>
            ) : (
              <ContextMenuPlugin
                data={alignedDataFrame}
                config={config}
                timeZone={timeZone}
                replaceVariables={replaceVariables}
                defaultItems={[]}
              />
            )}
            {data.annotations && (
              <ExemplarsPlugin
                config={config}
                exemplars={data.annotations}
                timeZone={timeZone}
                getFieldLinks={getFieldLinks}
              />
            )}

            {((canEditThresholds && onThresholdsChange) || showThresholds) && (
              <ThresholdControlsPlugin
                config={config}
                fieldConfig={fieldConfig}
                onThresholdsChange={canEditThresholds ? onThresholdsChange : undefined}
              />
            )}

            <OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />
          </>
        );
      }}
    </TimeSeries>
  );
};
