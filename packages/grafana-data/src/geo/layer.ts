import OpenLayersMap from 'ol/Map';
import BaseLayer from 'ol/layer/Base';
import { ReactNode } from 'react';

import { MapLayerOptions, FrameGeometrySourceMode } from '@grafana/schema';

import { EventBus } from '../events/types';
import { StandardEditorContext } from '../field/standardFieldConfigEditorRegistry';
import { GrafanaTheme2 } from '../themes/types';
import { PanelData } from '../types/panel';
import { PanelOptionsEditorBuilder } from '../utils/OptionsUIBuilders';
import { RegistryItemWithOptions } from '../utils/Registry';

/**
 * @deprecated use the type from schema
 */
export { FrameGeometrySourceMode };

/**
 * @deprecated use the type from schema
 */
export type { FrameGeometrySource, MapLayerOptions } from '@grafana/schema';

/**
 * @alpha
 */
export interface MapLayerHandler<TConfig = any> {
  init: () => BaseLayer;
  /**
   * The update function should only be implemented if the layer type makes use of query data
   */
  update?: (data: PanelData) => void;

  /** Optional callback for cleanup before getting removed */
  dispose?: () => void;

  /** return react node for the legend */
  legend?: ReactNode;

  /**
   * Show custom elements in the panel edit UI
   */
  registerOptionsUI?: (
    builder: PanelOptionsEditorBuilder<MapLayerOptions<TConfig>>,
    context: StandardEditorContext<MapLayerOptions<TConfig>>
  ) => void;
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
