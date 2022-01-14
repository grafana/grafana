import { FeatureLike } from 'ol/Feature';
import { SimpleGeometry } from 'ol/geom';
import { Layer } from 'ol/layer';
import { DataHoverPayload } from '@grafana/data';
import { Source } from 'ol/source';
import LayerRenderer from 'ol/renderer/Layer';

export interface GeomapHoverFeature {
  feature: FeatureLike;
  layer: Layer<Source, LayerRenderer<any>>; // RendererType
  geo: SimpleGeometry;
}

export interface GeomapHoverPayload extends DataHoverPayload {
  features?: GeomapHoverFeature[];
  feature?: FeatureLike;
  pageX: number;
  pageY: number;
}
