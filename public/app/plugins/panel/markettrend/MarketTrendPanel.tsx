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
import { defaultColors } from './types';

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

  const renderers = useMemo(() => {
    const { mode, priceStyle, fieldMap, movementMode } = options;
    const colors = { ...defaultColors, ...options.colors };
    let { open, high, low, close, volume } = fieldMap;

    if (open == null || close == null) {
      return [];
    }

    let volumeAlpha = 0.5;

    // find volume field and set overrides
    if (frames && volume != null) {
      let volumeField = findField(data?.series, volume);

      if (volumeField) {
        let { fillOpacity } = volumeField.config.custom;

        if (fillOpacity) {
          volumeAlpha = fillOpacity / 100;
        }

        volumeField.config.unit = 'short';
        volumeField.display = getDisplayProcessor({
          field: volumeField,
          theme: config.theme2,
        });
      }
    }

    return [
      {
        fields: { open, high, low, close, volume },
        init: (builder: UPlotConfigBuilder, fieldIndices: FieldIndices) => {
          builder.addHook(
            'drawAxes',
            drawMarkers({
              mode,
              fields: fieldIndices,
              upColor: config.theme2.visualization.getColorByName(colors.up),
              downColor: config.theme2.visualization.getColorByName(colors.down),
              flatColor: config.theme2.visualization.getColorByName(colors.flat),
              volumeAlpha,
              movementMode,
              priceStyle,
            })
          );
        },
      },
    ];
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
