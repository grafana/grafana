import React, { FC } from 'react';
import { VizLayout } from '../VizLayout/VizLayout';
import { LegendDisplayMode, VizLegendItem } from '../VizLegend/types';
import { VizLegend } from '../VizLegend/VizLegend';
import { PieChart, DEFAULT_COLOR, Props as PieChartProps } from './PieChart';

export interface Props extends PieChartProps {}

export const PieChartWithLegend: FC<Props> = ({ values, width, height, ...restProps }) => {
  const legendItems = values.map<VizLegendItem>((value) => {
    console.log(value.title, value.color);
    return {
      label: value.title ?? '',
      color: value.color ?? DEFAULT_COLOR,
      yAxis: 1,
    };
  });

  const legendElement = (
    <VizLegend items={legendItems} placement="right" displayMode={LegendDisplayMode.List}></VizLegend>
  );

  return (
    <VizLayout width={width} height={height} legend={legendElement}>
      {(vizWidth: number, vizHeight: number) => (
        <PieChart values={values} width={vizWidth} height={vizHeight} {...restProps}></PieChart>
      )}
    </VizLayout>
  );
};
