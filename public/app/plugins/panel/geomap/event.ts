import { FeatureLike } from 'ol/Feature';
import { SimpleGeometry } from 'ol/geom';
import { DataHoverPayload } from '@grafana/data';
import BaseLayer from 'ol/layer/Base';

export interface GeomapHoverFeature {
  feature: FeatureLike;
  layer: BaseLayer;
  geo: SimpleGeometry;
}

export interface GeomapHoverPayload extends DataHoverPayload {
  features?: GeomapHoverFeature[];
  feature?: FeatureLike;
  pageX: number;
  pageY: number;
}
