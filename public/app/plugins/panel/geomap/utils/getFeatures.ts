import { DataFrame } from '@grafana/data';
import { DimensionSupplier } from 'app/features/dimensions';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { StyleMaker } from '../style/types';
import { LocationInfo } from './location';

export interface FeaturesStylesBuilderConfig {
  colorDim: DimensionSupplier<string>;
  sizeDim: DimensionSupplier<number>;
  opacity: number;
  styleMaker: StyleMaker;
  textDim?: DimensionSupplier<string>;
}

export const getFeatures = (
  frame: DataFrame,
  info: LocationInfo,
  config: FeaturesStylesBuilderConfig
): Array<Feature<Point>> | undefined => {
  const features: Array<Feature<Point>> = [];
  const opacity = config.opacity;

  // Map each data value into new points
  for (let i = 0; i < frame.length; i++) {
    // Get the color for the feature based on color scheme
    const color = config.colorDim.get(i);

    // Get the size for the feature based on size dimension
    const size = config.sizeDim.get(i);

    // Get the text for the feature based on text dimension
    const text = config?.textDim ? config?.textDim.get(i) : undefined;

    // Create a new Feature for each point returned from dataFrameToPoints
    const dot = new Feature(info.points[i]);
    dot.setProperties({
      frame,
      rowIndex: i,
    });

    dot.setStyle(config.styleMaker({ color, size, text, opacity }));
    features.push(dot);
  }

  return features;
};
