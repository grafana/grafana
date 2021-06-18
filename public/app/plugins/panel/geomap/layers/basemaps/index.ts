import { esriLayers } from './esri';
import { osmLayers } from './osm';
import { stamenLayers } from './stamen';

/**
 * Registry for layer handlers
 */
export const basemapLayers = [
  ...esriLayers,
  ...osmLayers,
  ...stamenLayers, //
];
