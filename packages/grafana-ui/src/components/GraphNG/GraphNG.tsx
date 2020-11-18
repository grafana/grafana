import React, { useMemo, useRef } from 'react';
import {
  DataFrame,
  FieldConfig,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldDisplayName,
  getTimeField,
  TIME_SERIES_TIME_FIELD_NAME,
} from '@grafana/data';
import { alignAndSortDataFramesByFieldName } from './utils';
import { UPlotChart } from '../uPlot/Plot';
import { AxisSide, GraphCustomFieldConfig, PlotProps } from '../uPlot/types';
import { useTheme } from '../../themes';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, LegendItem, LegendOptions } from '../Legend/Legend';
import { GraphLegend } from '../Graph/GraphLegend';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

interface GraphNGProps extends Omit<PlotProps, 'data' | 'config'> {
  data: DataFrame[];
  legend?: LegendOptions;
}

export const GraphNG: React.FC<GraphNGProps> = ({
  data,
  children,
  width,
  height,
  legend,
  timeRange,
  timeZone,
  ...plotProps
}) => {
  const theme = useTheme();
  const alignedData = useMemo(() => alignAndSortDataFramesByFieldName(data, TIME_SERIES_TIME_FIELD_NAME), [data]);
  const legendItemsRef = useRef<LegendItem[]>([]);
  const hasLegend = legend && legend.displayMode !== LegendDisplayMode.Hidden;

  if (!alignedData) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const configBuilder = useMemo(() => {
    const builder = new UPlotConfigBuilder();

    let { timeIndex } = getTimeField(alignedData);

    if (timeIndex === undefined) {
      timeIndex = 0; // assuming first field represents x-domain
      builder.addScale({
        scaleKey: 'x',
      });
    } else {
      builder.addScale({
        scaleKey: 'x',
        isTime: true,
      });
    }

    builder.addAxis({
      scaleKey: 'x',
      isTime: true,
      side: AxisSide.Bottom,
      timeZone,
      theme,
    });

    let seriesIdx = 0;
    const legendItems: LegendItem[] = [];

    for (let i = 0; i < alignedData.fields.length; i++) {
      const field = alignedData.fields[i];
      const config = field.config as FieldConfig<GraphCustomFieldConfig>;
      const customConfig = config.custom;

      if (i === timeIndex || field.type !== FieldType.number) {
        continue;
      }

      const fmt = field.display ?? defaultFormatter;
      const scale = config.unit || '__fixed';

      if (!builder.hasScale(scale)) {
        builder.addScale({ scaleKey: scale });
        builder.addAxis({
          scaleKey: scale,
          label: config.custom?.axis?.label,
          size: config.custom?.axis?.width,
          side: config.custom?.axis?.side || AxisSide.Left,
          grid: config.custom?.axis?.grid,
          formatValue: v => formattedValueToString(fmt(v)),
          theme,
        });
      }

      // need to update field state here because we use a transform to merge framesP
      field.state = { ...field.state, seriesIndex: seriesIdx };

      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);

      builder.addSeries({
        scaleKey: scale,
        line: customConfig?.line?.show,
        lineColor: seriesColor,
        lineWidth: customConfig?.line?.width,
        points: customConfig?.points?.show,
        pointSize: customConfig?.points?.radius,
        pointColor: seriesColor,
        fill: customConfig?.fill?.alpha !== undefined,
        fillOpacity: customConfig?.fill?.alpha,
        fillColor: seriesColor,
      });

      if (hasLegend) {
        legendItems.push({
          color: seriesColor,
          label: getFieldDisplayName(field, alignedData),
          yAxis: customConfig?.axis?.side === 1 ? 3 : 1,
        });
      }

      seriesIdx++;
    }

    legendItemsRef.current = legendItems;
    return builder;
  }, [alignedData, hasLegend]);

  let legendElement: React.ReactElement | undefined;

  if (hasLegend && legendItemsRef.current.length > 0) {
    legendElement = (
      <VizLayout.Legend position={legend!.placement} maxHeight="35%" maxWidth="60%">
        <GraphLegend placement={legend!.placement} items={legendItemsRef.current} displayMode={legend!.displayMode} />
      </VizLayout.Legend>
    );
  }

  return (
    <VizLayout width={width} height={height} legend={legendElement}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart
          data={alignedData}
          config={configBuilder}
          width={vizWidth}
          height={vizHeight}
          timeRange={timeRange}
          timeZone={timeZone}
          {...plotProps}
        >
          {children}
        </UPlotChart>
      )}
    </VizLayout>
  );
};
