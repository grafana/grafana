import { type FeatureLike } from 'ol/Feature';
import type OpenLayersMap from 'ol/Map';
import { type Units } from 'ol/control/ScaleLine';
import type BaseLayer from 'ol/layer/Base';
import { type Subject } from 'rxjs';

import { type MapLayerHandler, type MapLayerOptions } from '@grafana/data/geo';
import { type ComparisonOperation } from '@grafana/schema';
import { type LayerElement } from 'app/core/components/Layers/types';

import { type ControlsOptions as ControlsOptionsBase } from './panelcfg.gen';
import { type StyleConfig } from './style/types';

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
