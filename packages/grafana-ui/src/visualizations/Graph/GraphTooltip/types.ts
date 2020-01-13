import { ActiveDimensions, TooltipMode } from '../../../components/Chart/Tooltip';
import { Dimension, Dimensions } from '@grafana/data/src/dataframe';

export interface GraphTooltipOptions {
  mode: TooltipMode;
}

export interface GraphDimensions extends Dimensions {
  xAxis: Dimension<number>;
  yAxis: Dimension<number>;
}

export interface GraphTooltipContentProps {
  dimensions: GraphDimensions; // Dimension[]
  activeDimensions: ActiveDimensions<GraphDimensions>;
}
