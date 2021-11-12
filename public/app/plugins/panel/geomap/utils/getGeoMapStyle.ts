import { Style, Stroke, Fill } from 'ol/style';
import { FeatureStyleConfig } from '../types';

/**
 * Gets a geomap style based on fill, stroke, and stroke width
 * @returns ol style
 */
export const getGeoMapStyle = (config: FeatureStyleConfig, property: any) => {
  return new Style({
    fill: new Fill({
      color: `${config.fillColor ?? '#1F60C4'}`,
    }),
    stroke: config?.strokeWidth
      ? new Stroke({
          color: `${config.fillColor ?? '#1F60C4'}`,
          width: config.strokeWidth,
        })
      : undefined,
  });
};
