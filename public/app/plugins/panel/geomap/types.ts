import { Map as OpenLayersMap } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Units } from 'ol/control/ScaleLine';
import BaseLayer from 'ol/layer/Base';
import { Subject } from 'rxjs';

import { MapLayerHandler, MapLayerOptions } from '@grafana/data';
import { HideableFieldConfig } from '@grafana/schema';
import { LayerElement } from 'app/core/components/Layers/types';

import * as raw from './models.gen';
import { StyleConfig } from './style/types';
import { MapCenterID } from './view';

export interface ControlsOptions extends raw.ControlsOptions {
  scaleUnits?: Units;
}

export enum TooltipMode {
  None = 'none',
  Details = 'details',
}

export interface TooltipOptions {
  mode: TooltipMode;
}

export interface MapViewConfig {
  id: string; // placename > lookup
  lat?: number;
  lon?: number;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  padding?: number;
  allLayers?: boolean;
  lastOnly?: boolean;
  layer?: string;
  shared?: boolean;
}

export const defaultView: MapViewConfig = {
  id: MapCenterID.Zero,
  lat: 0,
  lon: 0,
  zoom: 1,
  allLayers: true,
};

/** Support hide from legend/tooltip */
export interface GeomapFieldConfig extends HideableFieldConfig {
  // nothing custom yet
}

export interface GeomapPanelOptions {
  view: MapViewConfig;
  controls: ControlsOptions;
  basemap: MapLayerOptions;
  layers: MapLayerOptions[];
  tooltip: TooltipOptions;
}

export interface FeatureStyleConfig {
  style?: StyleConfig;
  check?: FeatureRuleConfig;
}

export interface FeatureRuleConfig {
  property: string;
  operation: ComparisonOperation;
  value: string | boolean | number;
}

export interface GeomapLayerActions {
  selectLayer: (uid: string) => void;
  deleteLayer: (uid: string) => void;
  addlayer: (type: string) => void;
  reorder: (src: number, dst: number) => void;
  canRename: (v: string) => boolean;
}

export interface GeomapInstanceState {
  map?: OpenLayersMap;
  layers: MapLayerState[];
  selected: number;
  actions: GeomapLayerActions;
}

export enum ComparisonOperation {
  EQ = 'eq',
  NEQ = 'neq',
  LT = 'lt',
  LTE = 'lte',
  GT = 'gt',
  GTE = 'gte',
}

//-------------------
// Runtime model
//-------------------
export interface MapLayerState<TConfig = unknown> extends LayerElement {
  options: MapLayerOptions<TConfig>;
  handler: MapLayerHandler;
  layer: BaseLayer; // the openlayers instance
  onChange: (cfg: MapLayerOptions<TConfig>) => void;
  isBasemap?: boolean;
  mouseEvents: Subject<FeatureLike | undefined>;
}

export * from './models.gen';
