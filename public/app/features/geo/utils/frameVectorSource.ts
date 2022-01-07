import { DataFrame } from '@grafana/data';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import VectorSource from 'ol/source/Vector';

export interface FrameVectorSourceOptions {}

export class FrameVectorSource extends VectorSource<Geometry> {
  constructor() {
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
    console.log('ADD FEATURES...');

    this.clear(true);
    for (let i = 0; i < frame.length; i++) {
      this.addFeatureInternal(
        new Feature({
          // each property
        })
      );
    }

    // only call this at the end
    this.changed();
  }
}
