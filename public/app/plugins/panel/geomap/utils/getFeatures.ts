import { DataFrame } from '@grafana/data';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { StyleConfigState } from '../style/types';
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
