import { DataFrame } from '@grafana/data';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import VectorSource from 'ol/source/Vector';
import { getGeometryField, LocationFieldMatchers } from './location';

export interface FrameVectorSourceOptions {}

export class FrameVectorSource extends VectorSource<Geometry> {
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
          geometry: info.field.values.get(i),
        })
      );
    }

    // only call this at the end
    this.changed();
  }
}
