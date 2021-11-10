import { DataFrame } from '@grafana/data';
import { DimensionSupplier } from 'app/features/dimensions';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import tinycolor from 'tinycolor2';
import { StyleMaker } from '../types';
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

  // Map each data value into new points
  for (let i = 0; i < frame.length; i++) {
    // Get the color for the feature based on color scheme
    const color = config.colorDim.get(i);

    // Get the size for the feature based on size dimension
    const size = config.sizeDim.get(i);

    // Get the text for the feature based on text dimension
    const label = config?.textDim ? config?.textDim.get(i) : undefined;

    // Set the opacity determined from user configuration
    const fillColor = tinycolor(color).setAlpha(config?.opacity).toRgbString();

    // Create a new Feature for each point returned from dataFrameToPoints
    const dot = new Feature(info.points[i]);
    dot.setProperties({
      frame,
      rowIndex: i,
    });

    if (config?.textDim) {
      dot.setStyle(config.styleMaker({ color, fillColor, size, text: label }));
    } else {
      dot.setStyle(config.styleMaker({ color, fillColor, size }));
    }
    features.push(dot);
  }

  return features;
};
