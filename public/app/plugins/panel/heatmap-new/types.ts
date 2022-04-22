import { NumericRange, DataFrame, DataHoverPayload } from '@grafana/data';
import { LayerElement } from 'app/core/components/Layers/types';
import { HeatmapHoverEvent } from './utils';

export interface HeatmapLayerState<TConfig = any> extends LayerElement {
  options: TConfig;
  handler: any;
  layer: any; // the openlayers instance
  onChange: (cfg: TConfig) => void;
}

export interface HeatmapLookup {
  xRange: NumericRange;
  yRange: NumericRange;
  count: number;
}

export interface RenderCallback {
  render: () => JSX.Element;
}

export interface HeatmapLayerHover {
  name: string;
  data: DataFrame[];
  header?: () => JSX.Element;
  footer?: () => JSX.Element;
}

export interface HeatmapHoverPayload extends DataHoverPayload {
  // List of layers
  layers: HeatmapLayerHover[];
  hover: HeatmapHoverEvent;
}

export interface HeatmapHoverProps<TOptions = any> {
  data: DataFrame[];
  options?: TOptions;
}
