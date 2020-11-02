import React, { useEffect, useState } from 'react';
import {
  DataFrame,
  FieldConfig,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getTimeField,
  systemDateFormats,
} from '@grafana/data';
import { timeFormatToTemplate } from '../uPlot/utils';
import { alignAndSortDataFramesByFieldName } from './utils';
import { Area, Axis, Line, Point, Scale, SeriesGeometry } from '../uPlot/geometries';
import { UPlotChart } from '../uPlot/Plot';
import { AxisSide, GraphCustomFieldConfig, PlotProps } from '../uPlot/types';
import { useTheme } from '../../themes';

const _ = null;

const timeStampsConfig = [
  //   tick incr    default          year                    month   day                   hour    min       sec   mode
  [3600 * 24 * 365, '{YYYY}', _, _, _, _, _, _, 1],
  [3600 * 24 * 28, `${timeFormatToTemplate(systemDateFormats.interval.month)}`, _, _, _, _, _, _, 1],
  [3600 * 24, `${timeFormatToTemplate(systemDateFormats.interval.day)}`, `\n{YYYY}`, _, _, _, _, _, 1],
  [
    3600,
    `${timeFormatToTemplate(systemDateFormats.interval.minute)}`,
    _,
    _,
    `\n${timeFormatToTemplate(systemDateFormats.interval.day)}`,
    _,
    _,
    _,
    1,
  ],
  [
    60,
    `${timeFormatToTemplate(systemDateFormats.interval.minute)}`,
    _,
    _,
    `\n${timeFormatToTemplate(systemDateFormats.interval.day)}`,
    _,
    _,
    _,
    1,
  ],
  [1, ':{ss}', _, _, _, _, `\n ${timeFormatToTemplate(systemDateFormats.interval.minute)}`, _, 1],
  [1e-3, ':{ss}.{fff}', _, _, _, _, `\n ${timeFormatToTemplate(systemDateFormats.interval.minute)}`, _, 1],
];

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

const TIME_FIELD_NAME = 'Time';

interface GraphNGProps extends Omit<PlotProps, 'data'> {
  data: DataFrame[];
}

export const GraphNG: React.FC<GraphNGProps> = ({ data, children, ...plotProps }) => {
  const theme = useTheme();
  const [alignedData, setAlignedData] = useState<DataFrame | null>(null);

  useEffect(() => {
    if (data.length === 0) {
      setAlignedData(null);
      return;
    }

    const subscription = alignAndSortDataFramesByFieldName(data, TIME_FIELD_NAME).subscribe(setAlignedData);

    return function unsubscribe() {
      subscription.unsubscribe();
    };
  }, [data]);

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
    scales.push(<Scale key="scale-x" scaleKey="x" time />);
  }

  axes.push(<Axis key="axis-scale--x" scaleKey="x" values={timeStampsConfig} side={AxisSide.Bottom} />);

  let seriesIdx = 0;
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

    seriesIdx++;
  }

  return (
    <UPlotChart data={alignedData} {...plotProps}>
      {scales}
      {axes}
      {geometries}
      {children}
    </UPlotChart>
  );
};
