import Feature from 'ol/Feature';
import { Geometry, LineString, Point } from 'ol/geom';
import VectorSource from 'ol/source/Vector';

import { DataFrame, Field } from '@grafana/data';

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

  updateLineString(frame: DataFrame) {
    this.clear(true);
    const info = getGeometryField(frame, this.location);
    if (!info.field) {
      this.changed();
      return;
    }

    //eslint-disable-next-line
    const field = info.field as unknown as Field<Point>;
    const geometry = new LineString(field.values.map((p) => p.getCoordinates())) as unknown as T;
    this.addFeatureInternal(
      createFeature({
        frame,
        rowIndex: 0,
        geometry,
      })
    );

    // only call this at the end
    this.changed();
  }
}
