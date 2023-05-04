import { Feature } from 'ol';
import { Geometry, LineString, Point } from 'ol/geom';
import VectorSource from 'ol/source/Vector';

import { DataFrame, Field } from '@grafana/data';

import { getGeometryField, LocationFieldMatchers } from './location';

export interface FrameVectorSourceOptions {}

export class FrameVectorSource<T extends Geometry = Geometry> extends VectorSource<T> {
  constructor(private location: LocationFieldMatchers) {
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
      this.addFeatureInternal(
        new Feature({
          frame,
          rowIndex: i,
          geometry: info.field.values[i] as T,
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
    const geometry = new LineString(field.values.map((p) => p.getCoordinates())) as Geometry;
    this.addFeatureInternal(
      new Feature({
        frame,
        rowIndex: 0,
        geometry: geometry as T,
      })
    );

    // only call this at the end
    this.changed();
  }
}
