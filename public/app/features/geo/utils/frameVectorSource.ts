import { DataFrame } from '@grafana/data';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import VectorSource from 'ol/source/Vector';
import { getGeometryField, LocationFieldMatchers } from './location';

export interface FrameVectorSourceOptions {}

export class FrameVectorSource extends VectorSource<Geometry> {
  constructor(private location: LocationFieldMatchers) {
    super({
      // attributions?: import("./Source.js").AttributionLike;
      // features?: Array<Feature<any>> | Collection<Feature<any>>;
      // format?: import("../format/Feature.js").default;
      // loader?: import("../featureloader.js").FeatureLoader;
      // overlaps?: boolean;
      // strategy?: LoadingStrategy;
      // url?: string | import("../featureloader.js").FeatureUrlFunction;
      // useSpatialIndex?: boolean;
      // wrapX?: boolean;
    });
  }

  update(frame: DataFrame) {
    this.clear(true);
    const info = getGeometryField(frame, this.location);
    if (!info.field) {
      this.changed();
      return;
    }

    for (let i = 0; i < frame.length; i++) {
      this.addFeatureInternal(
        new Feature({
          frame,
          rowIndex: i,
          geometry: info.field.values.get(i),
        })
      );
    }

    // only call this at the end
    this.changed();
  }
}
