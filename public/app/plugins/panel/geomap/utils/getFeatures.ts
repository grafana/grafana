import { DataFrame, Registry, SelectableValue } from '@grafana/data';
import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';
import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Point } from 'ol/geom';
import { getMarkerMaker, markerMakers, prepareImage, prepareSVG } from '../style/markers';
import { GeometryTypeId, PreppedImage, StyleConfigState } from '../style/types';
import { LocationInfo } from './location';

export const getFeatures = async (
  frame: DataFrame,
  info: LocationInfo,
  style: StyleConfigState
): Promise<Array<Feature<Point>> | undefined> => {
  const features: Array<Feature<Point>> = [];
  const { dims } = style;
  const values = { ...style.base };

  const formattedImage = new Registry<PreppedImage>();

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
      if (dims.rotation) {
        values.rotation = dims.rotation.get(i);
      }
      if (dims.text) {
        values.text = dims.text.get(i);
      }

      // style based on dynamic style maker
      if (dims.symbol) {
        const symbol = dims.symbol.get(i);

        const symbolMaker = markerMakers.getIfExists(symbol);

        if (symbolMaker) {
          //check if maker is registered
          dot.setStyle(symbolMaker.make(values));
        } else {
          let dynamicMarker;

          if (symbol.endsWith('.svg')) {
            const svg = formattedImage.getIfExists(symbol);
            if (!svg) {
              const newSvg = await prepareSVG(getPublicOrAbsoluteUrl(symbol));
              values.symbol = newSvg;
              formattedImage.register({ id: symbol, name: symbol, aliasIds: [], image: newSvg });
            } else {
              values.symbol = svg.image;
            }
            dynamicMarker = await getMarkerMaker(values.symbol, style.hasText);
            markerMakers.register({ id: symbol, name: symbol, aliasIds: [], make: dynamicMarker });
          } else {
            const image = formattedImage.getIfExists(symbol);

            if (!image) {
              const size = values.size ?? 100;
              const newImage = await prepareImage(dims.symbol.get(i), size, values.color);
              if (!newImage) {
                console.log('failed to load image');
              } else {
                values.symbol = newImage;
                formattedImage.register({ id: symbol, name: symbol, aliasIds: [], image: newImage });
              }
            } else {
              values.symbol = image.image;
            }
            dynamicMarker = await getMarkerMaker(values.symbol, style.hasText, true);
          }
          dot.setStyle(dynamicMarker(values));
        }
      } else {
        //non-dynamic style maker
        dot.setStyle(style.maker(values));
      }
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
