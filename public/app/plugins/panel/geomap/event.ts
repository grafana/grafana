import { FeatureLike } from 'ol/Feature';
import { SimpleGeometry } from 'ol/geom';
import { Layer } from 'ol/layer';
import { DataHoverPayload } from '@grafana/data';
import { Source } from 'ol/source';

export interface GeomapHoverFeature {
  feature: FeatureLike;
  layer: Layer<Source>;
  geo: SimpleGeometry;
}

export interface GeomapHoverPayload extends DataHoverPayload {
  features?: GeomapHoverFeature[];
  pageX: number;
  pageY: number;
}
