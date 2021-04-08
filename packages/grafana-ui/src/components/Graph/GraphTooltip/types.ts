import { ActiveDimensions } from '../../Chart/Tooltip';
import { Dimension, Dimensions, TimeZone } from '@grafana/data';
import { TooltipMode } from '../../Chart/models.gen';

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
  timeZone?: TimeZone;
}
