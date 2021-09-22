import { Style, Stroke, Fill } from 'ol/style';
import { FeatureStyleConfig } from '../types';

/**
 * Gets a geomap style based on fill, stroke, and stroke width
 * @returns ol style
 */
export const getGeoMapStyle = (config: FeatureStyleConfig, property: any) => {
  return new Style({
    fill:
      config.fill &&
      new Fill({
        color: `${config.fill}`,
      }),
    stroke:
      config.stroke &&
      new Stroke({
        color: `${config.stroke}`,
        width: config.strokeWidth ?? 1,
      }),
    //handle a shape/marker too?
  });
};
