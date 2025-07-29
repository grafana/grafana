import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import VectorSource from 'ol/source/Vector';

import { DataFrame } from '@grafana/data';

import { getGeometryField, LocationFieldMatchers } from './location';

export interface FrameVectorSourceOptions {}

// Helper function to create properly typed Features
function createFeature<T extends Geometry>(properties: {
  frame: DataFrame;
  rowIndex: number;
  geometry: T;
}): Feature<T> {
  const feature = new Feature(properties);
  return feature;
}

export class FrameVectorSource<T extends Geometry = Geometry> extends VectorSource<Feature<T>> {
  constructor(public location: LocationFieldMatchers) {
    super({});
  }

  update(frame: DataFrame) {
    this.clear(true);
    const info = getGeometryField(frame, this.location);
    if (!info.field) {
      this.changed();
      return;
    }

    for (let i = 0; i < frame.length; i++) {
      const geometry = info.field.values[i] as T;
      this.addFeatureInternal(
        createFeature({
          frame,
          rowIndex: i,
          geometry,
        })
      );
    }

    // only call this at the end
    this.changed();
  }
}
