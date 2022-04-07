import { DataFrame, DataHoverPayload } from '@grafana/data';

export interface ExemplarLayerHover {
  name: string;
  data: DataFrame[];
}

export interface ExemplarHoverPayload extends DataHoverPayload {
  // List of layers
  layers?: ExemplarLayerHover[];

  // Global mouse coordinates for the hover layer
  pageX: number;
  pageY: number;
}
