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

  updateEdge(frames: DataFrame[]) {
    this.clear(true);
    // find location frame
    const frameNodes = frames[0];
    const frameEdges = frames[1];
    console.log(frames);

    const info = getGeometryField(frameNodes, this.location);
    if (!info.field) {
      this.changed();
      return;
    }
    //eslint-disable-next-line
    const field = info.field as unknown as Field<Point>;

    // Edges
    const sourceIndex = frameEdges.fields.findIndex((f) => {
      return f.name === 'source';
    });
    const targetIndex = frameEdges.fields.findIndex((f) => {
      return f.name === 'target';
    });
    const sources = frameEdges.fields[sourceIndex].values;
    const targets = frameEdges.fields[targetIndex].values;

    // Loop through edges, referencing node locations
    for (let i = 0; i < sources.length; i++) {
      // Create linestring for each edge
      const si = sources[i];
      const ti = targets[i];
      const sourceValue = field.values[si].getCoordinates();
      const targetValue = field.values[ti].getCoordinates();
      const geometryEdge = new LineString([sourceValue, targetValue]) as Geometry;
      this.addFeatureInternal(
        new Feature({
          geometry: geometryEdge as T,
        })
      );
    }

    // Nodes
    for (let i = 0; i < frameNodes.length; i++) {
      this.addFeatureInternal(
        new Feature({
          frameNodes,
          rowIndex: i,
          geometry: info.field.values[i] as T,
        })
      );
    }

    // only call this at the end
    this.changed();
  }
}
