import { FeatureLike } from 'ol/Feature';
import { SimpleGeometry } from 'ol/geom';
import { Layer } from 'ol/layer';
import { DataHoverPayload } from '@grafana/data';

export interface GeomapHoverFeature {
  feature: FeatureLike;
  layer: Layer;
  geo: SimpleGeometry;
}

export interface GeomapHoverPayload extends DataHoverPayload {
  features?: GeomapHoverFeature[];
  pageX: number;
  pageY: number;
}
