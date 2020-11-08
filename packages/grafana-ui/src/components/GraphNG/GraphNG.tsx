import React from 'react';
import { DataFrame, systemDateFormats } from '@grafana/data';
import { timeFormatToTemplate } from '../uPlot/utils';
import { alignAndSortDataFramesByFieldName } from './utils';
import { Area, Axis, Line, Point, Scale, SeriesGeometry } from '../uPlot/geometries';
import { UPlotChart } from '../uPlot/Plot';
import { PlotProps } from '../uPlot/types';

interface GraphNGProps extends Omit<PlotProps, 'data'> {
  data: DataFrame[];
}

export const GraphNG: React.FC<GraphNGProps> = () => {
  return <div>TODO! the plot!!!!</div>;
};
