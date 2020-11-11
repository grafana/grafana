import React, { useMemo } from 'react';
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
import { Area, Axis, Line, Point, Scale, SeriesGeometry } from '../uPlot/geometries';
import { UPlotChart } from '../uPlot/Plot';
import { AxisSide, GraphCustomFieldConfig, PlotProps } from '../uPlot/types';
import { useTheme } from '../../themes';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendItem, LegendOptions } from '../Legend/Legend';
import { GraphLegend } from '../Graph/GraphLegend';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

interface GraphNGProps extends Omit<PlotProps, 'data'> {
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

  if (!alignedData) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const geometries: React.ReactNode[] = [];
  const scales: React.ReactNode[] = [];
  const axes: React.ReactNode[] = [];

  let { timeIndex } = getTimeField(alignedData);
  if (timeIndex === undefined) {
    timeIndex = 0; // assuming first field represents x-domain
    scales.push(<Scale key="scale-x" scaleKey="x" />);
  } else {
    scales.push(<Scale key="scale-x" scaleKey="x" isTime />);
  }

  axes.push(<Axis key="axis-scale-x" scaleKey="x" isTime side={AxisSide.Bottom} timeZone={timeZone} />);

  let seriesIdx = 0;
  const legendItems: LegendItem[] = [];
  const uniqueScales: Record<string, boolean> = {};

  for (let i = 0; i < alignedData.fields.length; i++) {
    const seriesGeometry = [];
    const field = alignedData.fields[i];
    const config = field.config as FieldConfig<GraphCustomFieldConfig>;
    const customConfig = config.custom;

    if (i === timeIndex || field.type !== FieldType.number) {
      continue;
    }

    const fmt = field.display ?? defaultFormatter;
    const scale = config.unit || '__fixed';

    if (!uniqueScales[scale]) {
      uniqueScales[scale] = true;
      scales.push(<Scale key={`scale-${scale}`} scaleKey={scale} />);
      axes.push(
        <Axis
          key={`axis-${scale}-${i}`}
          scaleKey={scale}
          label={config.custom?.axis?.label}
          size={config.custom?.axis?.width}
          side={config.custom?.axis?.side || AxisSide.Left}
          grid={config.custom?.axis?.grid}
          formatValue={v => formattedValueToString(fmt(v))}
        />
      );
    }

    // need to update field state here because we use a transform to merge framesP
    field.state = { ...field.state, seriesIndex: seriesIdx };

    const colorMode = getFieldColorModeForField(field);
    const seriesColor = colorMode.getCalculator(field, theme)(0, 0);

    if (customConfig?.line?.show) {
      seriesGeometry.push(
        <Line
          key={`line-${scale}-${i}`}
          scaleKey={scale}
          stroke={seriesColor}
          width={customConfig?.line.show ? customConfig?.line.width || 1 : 0}
        />
      );
    }

    if (customConfig?.points?.show) {
      seriesGeometry.push(
        <Point key={`point-${scale}-${i}`} scaleKey={scale} size={customConfig?.points?.radius} stroke={seriesColor} />
      );
    }

    if (customConfig?.fill?.alpha) {
      seriesGeometry.push(
        <Area key={`area-${scale}-${i}`} scaleKey={scale} fill={customConfig?.fill.alpha} color={seriesColor} />
      );
    }

    if (seriesGeometry.length > 1) {
      geometries.push(
        <SeriesGeometry key={`seriesGeometry-${scale}-${i}`} scaleKey={scale}>
          {seriesGeometry}
        </SeriesGeometry>
      );
    } else {
      geometries.push(seriesGeometry);
    }

    if (legend?.isVisible) {
      legendItems.push({
        color: seriesColor,
        label: getFieldDisplayName(field, alignedData),
        isVisible: true,
        yAxis: customConfig?.axis?.side === 1 ? 3 : 1,
      });
    }

    seriesIdx++;
  }

  let legendElement: React.ReactElement | undefined;

  if (legend?.isVisible && legendItems.length > 0) {
    legendElement = (
      <VizLayout.Legend position={legend.placement} maxHeight="35%" maxWidth="60%">
        <GraphLegend placement={legend.placement} items={legendItems} displayMode={legend.displayMode} />
      </VizLayout.Legend>
    );
  }

  return (
    <VizLayout width={width} height={height} legend={legendElement}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart
          data={alignedData}
          width={vizWidth}
          height={vizHeight}
          timeRange={timeRange}
          timeZone={timeZone}
          {...plotProps}
        >
          {scales}
          {axes}
          {geometries}
          {children}
        </UPlotChart>
      )}
    </VizLayout>
  );
};
