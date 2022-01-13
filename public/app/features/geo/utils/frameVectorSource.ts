import { DataFrame, FieldType } from '@grafana/data';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import VectorSource from 'ol/source/Vector';
import { LocationFieldMatchers, setGeometryOnFrame } from './location';

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

  update(input: DataFrame) {
    this.clear(true);
    const frame = setGeometryOnFrame(input, this.location);
    const geo = frame.fields.find((f) => f.type === FieldType.geo);
    if (!geo) {
      this.changed();
      return;
    }

    for (let i = 0; i < frame.length; i++) {
      this.addFeatureInternal(
        new Feature({
          frame,
          rowIndex: i,
          geometry: geo.values.get(i),
        })
      );
    }

    // only call this at the end
    this.changed();
  }
}
