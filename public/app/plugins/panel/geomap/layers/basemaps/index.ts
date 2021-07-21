import { cartoLayers } from './carto';
import { esriLayers } from './esri';
import { genericLayers } from './generic';
import { osmLayers } from './osm';
import { defaultLayers } from './default';

export const defaultGrafanaThemedMap = {
  ...defaultLayers,
  id: 'default',
  name: 'Default base layer',
};

/**
 * Registry for layer handlers
 */
export const basemapLayers = [
  defaultGrafanaThemedMap,
  ...osmLayers,
  ...cartoLayers,
  ...esriLayers, // keep formatting
  ...genericLayers,
];
