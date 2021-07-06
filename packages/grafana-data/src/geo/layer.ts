import { RegistryItemWithOptions } from '../utils/Registry';
import BaseLayer from 'ol/layer/Base';
import Map from 'ol/Map';
import { PanelData } from '../types';
import { GrafanaTheme2 } from '../themes';
import { PanelOptionsEditorBuilder } from '../utils';

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
  /**
   * This layer can be used as a background
   */
  isBaseMap?: boolean;

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig<TConfig>, theme: GrafanaTheme2) => MapLayerHandler;

  /**
   * Show custom elements in the panel edit UI
   */
  registerOptionsUI?: (builder: PanelOptionsEditorBuilder<TConfig>) => void;
}
