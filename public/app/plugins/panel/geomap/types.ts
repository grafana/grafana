import { Map as OpenLayersMap } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Units } from 'ol/control/ScaleLine';
import BaseLayer from 'ol/layer/Base';
import { Subject } from 'rxjs';

import { MapLayerHandler, MapLayerOptions } from '@grafana/data';
import { ComparisonOperation } from '@grafana/schema';
import { LayerElement } from 'app/core/components/Layers/types';

import { ControlsOptions as ControlsOptionsBase } from './panelcfg.gen';
import { StyleConfig } from './style/types';

export interface ControlsOptions extends ControlsOptionsBase {
  scaleUnits?: Units;
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

export { Options, MapViewConfig, TooltipOptions, TooltipMode, defaultMapViewConfig } from './panelcfg.gen';
