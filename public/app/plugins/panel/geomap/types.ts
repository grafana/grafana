import { MapLayerHandler, MapLayerOptions, SelectableValue } from '@grafana/data';
import BaseLayer from 'ol/layer/Base';
import { Units } from 'ol/proj/Units';
import { MapCenterID } from './view';

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

export interface GeomapPanelOptions {
  view: MapViewConfig;
  controls: ControlsOptions;
  basemap: MapLayerOptions;
  layers: MapLayerOptions[];
}
export interface FeatureStyleConfig {
  fillColor: string; //eventually be ColorDimensionConfig
  opacity?: number;
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
export interface GazetteerPathEditorConfigSettings {
  options?: Array<SelectableValue<string>>;
}

//-------------------
// Runtime model
//-------------------
export interface MapLayerState<TConfig = any> {
  options: MapLayerOptions<TConfig>;
  handler: MapLayerHandler;
  layer: BaseLayer; // the openlayers instance
  onChange: (cfg: MapLayerOptions<TConfig>) => void;
  isBasemap?: boolean;
}
