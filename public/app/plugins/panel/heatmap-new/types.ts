import { DataFrame, DataHoverPayload } from '@grafana/data';

import { HeatmapData } from './fields';
import { HeatmapHoverEvent } from './utils';

export interface RenderCallback {
  render: () => JSX.Element;
}

export interface HeatmapLayerHover {
  name: string;
  data?: DataFrame;
  indicies?: number[];
  header?: () => JSX.Element;
  footer?: () => JSX.Element;
}

export interface HeatmapHoverPayload extends DataHoverPayload {
  // List of layers
  layers: HeatmapLayerHover[];
  hover: HeatmapHoverEvent;
}

export interface HeatmapHoverProps<TOptions = any> {
  heatmapData?: HeatmapData;
  index?: number;
  options?: TOptions;
}
