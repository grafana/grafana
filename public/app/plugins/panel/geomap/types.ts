import { FeatureLike } from 'ol/Feature';
import BaseLayer from 'ol/layer/Base';
import { Subject } from 'rxjs';

import { MapLayerHandler, MapLayerOptions } from '@grafana/data';
import { HideableFieldConfig } from '@grafana/schema';
import { LayerElement } from 'app/core/components/Layers/types';

import { MapViewConfig, ControlsOptions, TooltipOptions } from './models.gen';
import { StyleConfig } from './style/types';
import { MapCenterID } from './view';

export const defaultView: MapViewConfig = {
  id: MapCenterID.Zero,
  lat: 0,
  lon: 0,
  zoom: 1,
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
export interface MapLayerState<TConfig = any> extends LayerElement {
  options: MapLayerOptions<TConfig>;
  handler: MapLayerHandler;
  layer: BaseLayer; // the openlayers instance
  onChange: (cfg: MapLayerOptions<TConfig>) => void;
  isBasemap?: boolean;
  mouseEvents: Subject<FeatureLike | undefined>;
}
