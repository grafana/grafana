import { cartoLayers, carto } from './carto';
import { esriLayers } from './esri';
import { osmLayers } from './osm';
import { stamenLayers } from './stamen';

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
  ...esriLayers,
  ...osmLayers,
  ...stamenLayers, // keeps indent
  ...cartoLayers,
];
