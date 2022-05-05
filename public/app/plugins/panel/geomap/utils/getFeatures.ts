import { FeatureLike } from 'ol/Feature';

import { SelectableValue } from '@grafana/data';

import { GeometryTypeId } from '../style/types';

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
