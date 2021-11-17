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
  const values = { ...style.base };

  // Map each data value into new points
  for (let i = 0; i < frame.length; i++) {
    // Create a new Feature for each point returned from dataFrameToPoints
    const dot = new Feature(info.points[i]);
    dot.setProperties({
      frame,
      rowIndex: i,
    });

    // Only create a new style if it depends on the data
    if (style.dims) {
      if (style.dims.color) {
        values.color = style.dims.color.get(i);
      }
      if (style.dims.size) {
        values.size = style.dims.size.get(i);
      }
      if (style.dims.text) {
        values.text = style.dims.text.get(i);
      }

      dot.setStyle(style.maker(values));
    }
    features.push(dot);
  }

  return features;
};
