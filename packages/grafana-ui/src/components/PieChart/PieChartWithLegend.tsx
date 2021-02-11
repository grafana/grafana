import React, { FC } from 'react';
import { Props as PieChartProps } from './PieChart';

export interface Props extends PieChartProps {}

export const PieChartWithLegend: FC<Props> = ({ width, height, ...restProps }) => {
  return <div>Need VizLayout in grafana/ui</div>;
};
