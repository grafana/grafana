// this file is pretty much a copy-paste of TimeSeriesPanel.tsx :(
// with some extra renderers passed to the <TimeSeries> component

import React, { useMemo } from 'react';
import { DataFrame, Field, getDisplayProcessor, getFieldDisplayName, PanelProps } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
import { usePanelContext, TimeSeries, TooltipPlugin, ZoomPlugin, UPlotConfigBuilder } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { AnnotationsPlugin } from '../timeseries/plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from '../timeseries/plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from '../timeseries/plugins/ExemplarsPlugin';
import { TimeSeriesOptions } from '../timeseries/types';
import { prepareGraphableFields } from '../timeseries/utils';
import { AnnotationEditorPlugin } from '../timeseries/plugins/AnnotationEditorPlugin';
import { ThresholdControlsPlugin } from '../timeseries/plugins/ThresholdControlsPlugin';
import { config } from 'app/core/config';
import { drawMarkers } from './utils';
import { defaultColors, MarketTrendMode } from './types';
import { ScaleProps } from '@grafana/ui/src/components/uPlot/config/UPlotScaleBuilder';
import { AxisProps } from '@grafana/ui/src/components/uPlot/config/UPlotAxisBuilder';

interface FieldIndices {
  [fieldKey: string]: number;
}

interface TimeSeriesPanelProps extends PanelProps<TimeSeriesOptions> {}

function findField(frames: DataFrame[], name: string) {
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (getFieldDisplayName(field, frame, frames) === name) {
        return field;
      }
    }
  }
}

export const MarketTrendPanel: React.FC<TimeSeriesPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, onSplitOpen } = usePanelContext();

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
  };

  const { frames, warn } = useMemo(() => prepareGraphableFields(data?.series, config.theme2), [data]);

  const { renderers, tweakScale, tweakAxis } = useMemo(() => {
    const { mode, priceStyle, fieldMap, colorStrategy } = options;
    const colors = { ...defaultColors, ...options.colors };
    let { open, high, low, close, volume } = fieldMap;

    let tweakScale = (opts: ScaleProps) => opts;
    let tweakAxis = (opts: AxisProps) => opts;

    if (
      open == null ||
      close == null ||
      findField(data?.series, open) == null ||
      findField(data?.series, close) == null
    ) {
      return {
        renderers: [],
        tweakScale,
        tweakAxis,
      };
    }

    let volumeAlpha = 0.5;

    let volumeIdx = -1;

    let canRenderVolume = false;

    // find volume field and set overrides
    if (frames && volume != null) {
      let volumeField = findField(data?.series, volume);

      if (volumeField != null) {
        canRenderVolume = true;

        let { fillOpacity } = volumeField.config.custom;

        if (fillOpacity) {
          volumeAlpha = fillOpacity / 100;
        }

        // we only want to put volume on own shorter axis when rendered with price
        if (mode !== MarketTrendMode.Volume) {
          volumeField.config.unit = 'short';
          volumeField.display = getDisplayProcessor({
            field: volumeField,
            theme: config.theme2,
          });

          tweakAxis = (opts: AxisProps) => {
            if (opts.scaleKey === 'short') {
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

          tweakScale = (opts: ScaleProps) => {
            if (opts.scaleKey === 'short') {
              opts.range = (u: uPlot, min: number, max: number) => [0, max * 7];
            }

            return opts;
          };
        }
      }
    }

    let canRenderPrice =
      high != null && low != null && findField(data?.series, high) != null && findField(data?.series, low) != null;

    let fields = {};
    let indicesOnly = [];

    if (canRenderPrice) {
      fields = { open, high, low, close };

      // hide series from legend that are rendered as composite markers
      for (let key in fields) {
        let field = findField(data?.series, fields[key]);
        field!.config.custom.hideFrom = { legend: true, tooltip: false, viz: false };
      }
    } else {
      // these fields should not be omitted from normal rendering if they arent rendered
      // as part of price markers. they're only here so we can get back their indicies in the
      // init callback below. TODO: remove this when field mapping happens in the panel instead of deep
      indicesOnly.push(open, close);
    }

    if (canRenderVolume) {
      fields.volume = volume;
      fields.open = open;
      fields.close = close;
    }

    return {
      renderers: [
        {
          fields,
          indicesOnly,
          init: (builder: UPlotConfigBuilder, fieldIndices: FieldIndices) => {
            volumeIdx = fieldIndices.volume;

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
                priceStyle,
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
  }, [options, data.structureRev]);

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  return (
    <TimeSeries
      frames={frames}
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
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            {options.tooltip.mode === TooltipDisplayMode.None || (
              <TooltipPlugin
                data={alignedDataFrame}
                config={config}
                mode={options.tooltip.mode}
                sync={sync}
                timeZone={timeZone}
              />
            )}
            {/* Renders annotation markers*/}
            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}
            {/* Enables annotations creation*/}
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
            {data.annotations && (
              <ExemplarsPlugin
                config={config}
                exemplars={data.annotations}
                timeZone={timeZone}
                getFieldLinks={getFieldLinks}
              />
            )}

            {canEditThresholds && onThresholdsChange && (
              <ThresholdControlsPlugin
                config={config}
                fieldConfig={fieldConfig}
                onThresholdsChange={onThresholdsChange}
              />
            )}
          </>
        );
      }}
    </TimeSeries>
  );
};
