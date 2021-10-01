import { ReactNode } from 'react';
import {
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  PanelOptionsEditorBuilder,
  RegistryItemWithOptions,
} from '@grafana/data';
import Map from 'ol/Map';
import BaseLayer from 'ol/layer/Base';
import { Units } from 'ol/proj/Units';
import { MapCenterID } from './view';
import { DimensionContext } from 'app/features/dimensions';

export interface ControlsOptions {
  // Zoom (upper left)
  showZoom?: boolean;

  // let the mouse wheel zoom
  mouseWheelZoom?: boolean;

  // Lower right
  showAttribution?: boolean;

  // Scale options
  showScale?: boolean;
  scaleUnits?: Units;

  // Show debug
  showDebug?: boolean;
}

export interface MapViewConfig {
  id: string; // placename > lookup
  lat?: number;
  lon?: number;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  shared?: boolean;
}

export const defaultView: MapViewConfig = {
  id: MapCenterID.Zero,
  lat: 0,
  lon: 0,
  zoom: 1,
};

/**
 * @alpha
 */
export interface MapLayerHandler {
  init: () => BaseLayer;
  update?: (data: PanelData, ctx?: DimensionContext) => void;
  legend?: ReactNode;
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
   * Show transparency controls in UI (for non-basemaps)
   */
  showOpacity?: boolean;

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerOptions<TConfig>, theme: GrafanaTheme2) => Promise<MapLayerHandler>;

  /**
   * Show custom elements in the panel edit UI
   */
  registerOptionsUI?: (builder: PanelOptionsEditorBuilder<MapLayerOptions<TConfig>>) => void;
}

export interface GeomapPanelOptions {
  view: MapViewConfig;
  controls: ControlsOptions;
  basemap: MapLayerOptions;
  layers: MapLayerOptions[];
}
export interface FeatureStyleConfig {
  fillColor: string; //eventually be ColorDimensionConfig
  strokeWidth?: number;
  rule?: FeatureRuleConfig;
}
export interface FeatureRuleConfig {
  property: string;
  operation: ComparisonOperation;
  value: string | boolean | number;
}

export enum ComparisonOperation {
  EQ = 'eq',
  LT = 'lt',
  LTE = 'lte',
  GT = 'gt',
  GTE = 'gte',
}
