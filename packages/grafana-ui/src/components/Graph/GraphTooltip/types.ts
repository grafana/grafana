import { Dimension, Dimensions, TimeZone } from '@grafana/data';

import { ActiveDimensions } from '../../VizTooltip';

export interface GraphDimensions extends Dimensions {
  xAxis: Dimension<number>;
  yAxis: Dimension<number>;
}

export interface GraphTooltipContentProps {
  dimensions: GraphDimensions; // Dimension[]
  activeDimensions: ActiveDimensions<GraphDimensions>;
  timeZone?: TimeZone;
}
