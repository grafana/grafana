import { FeatureLike } from 'ol/Feature';

import { DataHoverPayload } from '@grafana/data';

import { MapLayerState } from './types';

export interface GeomapLayerHover {
  layer: MapLayerState;
  features: FeatureLike[];
}

export interface GeomapHoverPayload extends DataHoverPayload {
  // List of layers
  layers?: GeomapLayerHover[];

  // Global mouse coordinates for the hover layer
  pageX: number;
  pageY: number;
}
