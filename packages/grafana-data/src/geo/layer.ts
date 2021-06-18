import { Registry, RegistryItemWithOptions } from '../utils/Registry';
import L from 'leaflet';
import { PanelData } from '../types';

/**
 * This gets saved in panel json
 *
 * depending on the type, it may have additional config
 *
 * This exists in `grafana/data` so the types are well known and extendable but the
 * layout/frame is control by the map panel
 *
 * @alpha
 */
export interface MapLayerConfig<TCustom = any> {
  type: string;

  url?: string; // tile server path
  name?: string; // custom display name
  maxZoom?: number;
  minZoom?: number;
  attributoin?: string;
  bounds?: L.BoundsLiteral;

  // Layer transparency
  transparency?: number;

  // Custom options depending on the type
  config?: TCustom;
}

/**
 * @alpha
 */
export interface MapLayerHandler {
  init: () => L.Layer;
  update?: (map: L.Map, data: PanelData) => void;
}

/**
 * Map layer configuration
 *
 * @alpha
 */
export interface MapLayerRegistryItem<TConfig = MapLayerConfig> extends RegistryItemWithOptions {
  // Single basemap in a map
  isBaseMap: boolean;

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (options: MapLayerConfig<TConfig>) => MapLayerHandler;
}
