import { DataFrame, SelectableValue } from '@grafana/data';
import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Point } from 'ol/geom';
import { GeometryTypeId, StyleConfigState } from '../style/types';
import { LocationInfo } from './location';

export const getFeatures = (
  frame: DataFrame,
  info: LocationInfo,
  style: StyleConfigState
): Array<Feature<Point>> | undefined => {
  const features: Array<Feature<Point>> = [];
  const { dims } = style;
  const values = { ...style.base };

  // Map each data value into new points
  for (let i = 0; i < frame.length; i++) {
    // Create a new Feature for each point returned from dataFrameToPoints
    const dot = new Feature(info.points[i]);
    dot.setProperties({
      frame,
      rowIndex: i,
    });

    // Update values used in dynamic styles
    if (dims) {
      if (dims.color) {
        values.color = dims.color.get(i);
      }
      if (dims.size) {
        values.size = dims.size.get(i);
      }
      if (dims.text) {
        values.text = dims.text.get(i);
      }

      dot.setStyle(style.maker(values));
    }
    features.push(dot);
  }

  return features;
};

export interface LayerContentInfo {
  geometryType: GeometryTypeId;
  propertes: Array<SelectableValue<string>>;
}

export function getLayerPropertyInfo(features: FeatureLike[]): LayerContentInfo {
  const types = new Set<string>();
  const props = new Set<string>();
  features.some((feature, idx) => {
    for (const key of Object.keys(feature.getProperties())) {
      if (key === 'geometry') {
        continue;
      }
      props.add(key);
      const g = feature.getGeometry();
      if (g) {
        types.add(g.getType());
      }
    }
    return idx > 10; // first 10 items
  });

  let geometryType = GeometryTypeId.Any;
  if (types.size === 1) {
    switch (types.values().next().value) {
      case 'Point':
      case 'MultiPoint':
        geometryType = GeometryTypeId.Point;
        break;
      case 'Line':
      case 'MultiLine':
        geometryType = GeometryTypeId.Line;
        break;
      case 'Polygon':
        geometryType = GeometryTypeId.Polygon;
    }
  }

  return {
    geometryType,
    propertes: Array.from(props.keys()).map((v) => ({ label: v, value: v })),
  };
}

export function getUniqueFeatureValues(features: FeatureLike[], key: string): string[] {
  const unique = new Set<string>();
  for (const feature of features) {
    const v = feature.get(key);
    if (v != null) {
      unique.add(`${v}`); // always string
    }
  }
  const buffer = Array.from(unique);
  buffer.sort();
  return buffer;
}
