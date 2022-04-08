import { NumericRange } from '@grafana/data';
import { LayerElement } from 'app/core/components/Layers/types';

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
