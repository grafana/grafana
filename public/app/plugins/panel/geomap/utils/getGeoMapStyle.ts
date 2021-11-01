import { Style, Stroke, Fill } from 'ol/style';
import { FeatureStyleConfig } from '../types';
import tinycolor from 'tinycolor2';

/**
 * Gets a geomap style based on fill, stroke, and stroke width
 * @returns ol style
 */
export const getGeoMapStyle = (config: FeatureStyleConfig, property: any) => {
  const fillColor = tinycolor(config?.fillColor ?? '#1F60C4')
    .setAlpha(config?.opacity ?? 0.8)
    .toRgbString();
  return new Style({
    fill: new Fill({
      color: fillColor,
    }),
    stroke: config?.strokeWidth
      ? new Stroke({
          color: `${config.fillColor ?? '#1F60C4'}`,
          width: config.strokeWidth,
        })
      : undefined,
  });
};
