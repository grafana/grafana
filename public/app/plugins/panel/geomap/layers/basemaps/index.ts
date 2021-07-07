import { cartoLayers, carto } from './carto';
import { esriLayers } from './esri';
import { genericLayers } from './generic';
import { osmLayers } from './osm';

// For now just use carto
export const defaultGrafanaThemedMap = {
  ...carto,
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
