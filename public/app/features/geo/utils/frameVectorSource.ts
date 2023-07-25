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
    const networkFrames = frames.reduce<{
      nodes: DataFrame[];
      edges: DataFrame[];
    }>(
      (acc, frame) => {
        const sourceField = frame.fields.filter((f) => f.name === 'source');
        if (sourceField.length) {
          acc.edges.push(frame);
        } else {
          acc.nodes.push(frame);
        }
        return acc;
      },
      { edges: [], nodes: [] }
    );

    const frameNodes = networkFrames.nodes[0];
    const frameEdges = networkFrames.edges[0];
    const info = getGeometryField(frameNodes, this.location);
    if (!info.field) {
      this.changed();
      return;
    }
    //eslint-disable-next-line
    const field = info.field as unknown as Field<Point>;

    // TODO for nodes, don't hard code id field name
    const nodeIdIndex = frameNodes.fields.findIndex((f) => {
      return f.name === 'id';
    });
    const nodeIdValues = frameNodes.fields[nodeIdIndex].values;

    // Edges
    // TODO for edges, don't hard code source and target fields
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
      const sourceId = sources[i];
      const targetId = targets[i];
      const sourceNodeIndex = nodeIdValues.findIndex((value) => value === sourceId);
      const targetNodeIndex = nodeIdValues.findIndex((value) => value === targetId);
      const geometryEdge = new LineString([
        field.values[sourceNodeIndex].getCoordinates(),
        field.values[targetNodeIndex].getCoordinates(),
      ]) as Geometry;
      const edgeFeature = new Feature({
        geometry: geometryEdge as T,
      });
      edgeFeature.setId(i);
      this.addFeatureInternal(edgeFeature);
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
