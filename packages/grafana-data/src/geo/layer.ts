import { RegistryItemWithOptions } from '../utils/Registry';
import BaseLayer from 'ol/layer/Base';
import Map from 'ol/Map';
import { PanelData } from '../types';
import { GrafanaTheme2 } from '../themes';

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
  name?: string; // configured display name
  hidden?: boolean; // in TOC, but not shown

  // Layer transparency
  transparency?: number;

  // Custom options depending on the type
  config?: TCustom;
}

/**
 * @alpha
 */
export interface MapLayerHandler {
  init: () => BaseLayer;
  update?: (map: Map, data: PanelData) => void;
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
  create: (map: Map, options: MapLayerConfig<TConfig>, theme: GrafanaTheme2) => MapLayerHandler;
}
