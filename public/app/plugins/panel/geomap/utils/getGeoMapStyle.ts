import { Style, Stroke, Fill } from 'ol/style';
import { ColorDimensionConfig } from 'app/features/dimensions';
import { GeoJSONMapperRule } from './checkFeatureMatchesStyleRule';

export interface GeoMapStyle {
  shape?: string;
  fill?: ColorDimensionConfig;
  stroke?: ColorDimensionConfig;
  strokeWidth?: number;
  rule?: GeoJSONMapperRule;
}

/**
 * Gets a geomap style based on fill, stroke, and stroke width
 * @returns ol style
 */
export const getGeoMapStyle = (config: GeoMapStyle, property: any) => {
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
        width: config.strokeWidth,
      }),
    //handle a shape/marker too?
  });
};
