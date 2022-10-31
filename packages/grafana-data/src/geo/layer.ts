import { Map as OpenLayersMap } from 'ol';
import BaseLayer from 'ol/layer/Base';
import { ReactNode } from 'react';

import { EventBus } from '../events';
import { GrafanaTheme2 } from '../themes';
import { MatcherConfig, PanelData } from '../types';
import { PanelOptionsEditorBuilder } from '../utils';
import { RegistryItemWithOptions } from '../utils/Registry';

/**
 * @alpha
 */
export enum FrameGeometrySourceMode {
  Auto = 'auto', // Will scan fields and find best match
  Geohash = 'geohash',
  Coords = 'coords', // lon field, lat field
  Lookup = 'lookup', // keys > location
  // H3 = 'h3',
  // WKT = 'wkt,
  // geojson? geometry text
}

/**
 * @alpha
 */
export interface FrameGeometrySource {
  mode: FrameGeometrySourceMode;

  // Field mappings
  geohash?: string;
  latitude?: string;
  longitude?: string;
  h3?: string;
  wkt?: string;
  lookup?: string;

  // Path to Gazetteer
  gazetteer?: string;
}

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
export interface MapLayerOptions<TConfig = any> {
  type: string;
  name: string; // configured unique display name

  // Custom options depending on the type
  config?: TConfig;

  // Common method to define geometry fields
  location?: FrameGeometrySource;

  // Defines which data query refId is associated with the layer
  filterData?: MatcherConfig;

  // Common properties:
  // https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html
  // Layer opacity (0-1)
  opacity?: number;

  // Check tooltip (defaults to true)
  tooltip?: boolean;
}

/**
 * @alpha
 */
export interface MapLayerHandler<TConfig = any> {
  init: () => BaseLayer;
  /**
   * The update function should only be implemented if the layer type makes use of query data
   */
  update?: (data: PanelData) => void;

  /** Optional callback to cleaup before getting removed */
  dispose?: () => void;

  /** return react node for the legend */
  legend?: ReactNode;

  /**
   * Show custom elements in the panel edit UI
   */
  registerOptionsUI?: (builder: PanelOptionsEditorBuilder<MapLayerOptions<TConfig>>) => void;
}

/**
 * Map layer configuration
 *
 * @alpha
 */
export interface MapLayerRegistryItem<TConfig = MapLayerOptions> extends RegistryItemWithOptions {
  /**
   * This layer can be used as a background
   */
  isBaseMap?: boolean;

  /**
   * Show location controls
   */
  showLocation?: boolean;

  /**
   * Hide transparency controls in UI
   */
  hideOpacity?: boolean;

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (
    map: OpenLayersMap,
    options: MapLayerOptions<TConfig>,
    eventBus: EventBus,
    theme: GrafanaTheme2
  ) => Promise<MapLayerHandler>;
}
