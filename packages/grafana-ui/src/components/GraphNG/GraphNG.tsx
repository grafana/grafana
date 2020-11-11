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
import { PlotProps } from '../uPlot/types';
import { GraphFieldConfig, AxisPlacement, PointMode, GraphMode, getUPlotSideFromAxis } from '../uPlot/config';
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
  axes.push(
    <Axis
      key="axis-scale-x"
      scaleKey="x"
      isTime
      side={getUPlotSideFromAxis(AxisPlacement.Bottom)}
      timeZone={timeZone}
    />
  );

  let seriesIdx = 0;
  const legendItems: LegendItem[] = [];
  const uniqueScales: Record<string, AxisPlacement> = {};
  let hasLeftAxis = false;
  let hasYAxis = false;

  for (let i = 0; i < alignedData.fields.length; i++) {
    const seriesGeometry = [];
    const field = alignedData.fields[i];
    const config = field.config as FieldConfig<GraphFieldConfig>;
    const customConfig = config.custom;

    if (i === timeIndex || field.type !== FieldType.number) {
      continue;
    }

    const fmt = field.display ?? defaultFormatter;
    const scale = config.unit || '__fixed';

    if (!uniqueScales[scale] && config.custom?.axisPlacement !== AxisPlacement.Hide) {
      const side = config.custom?.axisPlacement ?? (hasLeftAxis ? AxisPlacement.Right : AxisPlacement.Left);
      if (side === AxisPlacement.Left) {
        hasLeftAxis = true;
      }

      uniqueScales[scale] = side;
      scales.push(<Scale key={`scale-${scale}`} scaleKey={scale} />);
      axes.push(
        <Axis
          key={`axis-${scale}-${i}`}
          scaleKey={scale}
          label={config.custom?.axisLabel}
          size={config.custom?.axisWidth}
          side={getUPlotSideFromAxis(side)}
          grid={!hasYAxis}
          formatValue={v => formattedValueToString(fmt(v))}
        />
      );
      hasYAxis = true;
    }

    // need to update field state here because we use a transform to merge framesP
    field.state = { ...field.state, seriesIndex: seriesIdx };

    const colorMode = getFieldColorModeForField(field);
    const seriesColor = colorMode.getCalculator(field, theme)(0, 0);

    if (customConfig?.mode !== GraphMode.Points) {
      seriesGeometry.push(
        <Line key={`line-${scale}-${i}`} scaleKey={scale} stroke={seriesColor} width={customConfig?.lineWidth ?? 0} />
      );
    }

    if (customConfig?.points !== PointMode.Never) {
      seriesGeometry.push(
        <Point
          key={`point-${scale}-${i}`}
          scaleKey={scale}
          size={customConfig?.pointRadius ?? 2}
          stroke={seriesColor}
        />
      );
    }

    if (customConfig?.fillAlpha) {
      seriesGeometry.push(
        <Area key={`area-${scale}-${i}`} scaleKey={scale} fill={customConfig?.fillAlpha} color={seriesColor} />
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
        yAxis: uniqueScales[scale] === AxisPlacement.Right ? 3 : 1,
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
