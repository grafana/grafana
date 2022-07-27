import { PluggableMap } from 'ol';
import BaseLayer from 'ol/layer/Base';
import { ReactNode } from 'react';

import { MapLayerOptions as MapLayerOptionsSchema } from '@grafana/schema';

import { EventBus } from '../events';
import { GrafanaTheme2 } from '../themes';
import { MatcherConfig, PanelData } from '../types';
import { PanelOptionsEditorBuilder } from '../utils';
import { RegistryItemWithOptions } from '../utils/Registry';

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
export interface MapLayerOptions<TConfig = any> extends Omit<MapLayerOptionsSchema, 'config' | 'filterData'> {
  // Custom options depending on the type
  config?: TConfig;
  filterData?: MatcherConfig;
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
    map: PluggableMap,
    options: MapLayerOptions<TConfig>,
    eventBus: EventBus,
    theme: GrafanaTheme2
  ) => Promise<MapLayerHandler>;
}
