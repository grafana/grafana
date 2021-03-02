import React, { useCallback } from 'react';
import { DataFrame, DisplayValue, fieldReducers, reduceField } from '@grafana/data';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import { VizLegendItem, VizLegendOptions } from '../VizLegend/types';
import { AxisPlacement } from './config';
import { VizLayout } from '../VizLayout/VizLayout';
import { mapMouseEventToMode } from '../GraphNG/utils';
import { VizLegend } from '../VizLegend/VizLegend';
import { GraphNGLegendEvent } from '..';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

interface PlotLegendProps extends VizLegendOptions {
  data: DataFrame[];
  config: UPlotConfigBuilder;
  onSeriesColorChange?: (label: string, color: string) => void;
  onLegendClick?: (event: GraphNGLegendEvent) => void;
}

export const PlotLegend: React.FC<PlotLegendProps> = ({
  data,
  config,
  onSeriesColorChange,
  onLegendClick,
  ...legend
}) => {
  const onLegendLabelClick = useCallback(
    (legend: VizLegendItem, event: React.MouseEvent) => {
      const { fieldIndex } = legend;

      if (!onLegendClick || !fieldIndex) {
        return;
      }

      onLegendClick({
        fieldIndex,
        mode: mapMouseEventToMode(event),
      });
    },
    [onLegendClick]
  );

  const legendItems = config
    .getSeries()
    .map<VizLegendItem | undefined>((s) => {
      const seriesConfig = s.props;
      const fieldIndex = seriesConfig.dataFrameFieldIndex;
      const axisPlacement = config.getAxisPlacement(s.props.scaleKey);

      if (seriesConfig.hideInLegend || !fieldIndex) {
        return undefined;
      }

      const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

      return {
        disabled: !seriesConfig.show ?? false,
        fieldIndex,
        color: seriesConfig.lineColor!,
        label: seriesConfig.fieldName,
        yAxis: axisPlacement === AxisPlacement.Left ? 1 : 2,
        getDisplayValues: () => {
          if (!legend.calcs?.length) {
            return [];
          }

          const fmt = field.display ?? defaultFormatter;
          const fieldCalcs = reduceField({
            field,
            reducers: legend.calcs,
          });

          return legend.calcs.map<DisplayValue>((reducer) => {
            return {
              ...fmt(fieldCalcs[reducer]),
              title: fieldReducers.get(reducer).name,
            };
          });
        },
      };
    })
    .filter((i) => i !== undefined) as VizLegendItem[];

  return (
    <VizLayout.Legend placement={legend.placement} maxHeight="35%" maxWidth="60%">
      <VizLegend
        onLabelClick={onLegendLabelClick}
        placement={legend.placement}
        items={legendItems}
        displayMode={legend.displayMode}
        onSeriesColorChange={onSeriesColorChange}
      />
    </VizLayout.Legend>
  );
};

PlotLegend.displayName = 'PlotLegend';
