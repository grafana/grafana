import { ComponentType } from 'react';
import { RegistryItem } from '@grafana/data';
import { Anchor, BackgroundConfig, LineConfig, Placement } from './types';
import { DimensionContext } from '../dimensions/context';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';

/**
 * This gets saved in panel json
 *
 * depending on the type, it may have additional config
 *
 * @alpha
 */
export interface CanvasElementOptions<TConfig = any> {
  name: string; // configured unique display name
  type: string;

  // Custom options depending on the type
  config?: TConfig;

  // Standard options available for all elements
  anchor?: Anchor; // defaults top, left, width and height
  placement?: Placement;
  background?: BackgroundConfig;
  border?: LineConfig;
}

export interface CanvasElementProps<TConfig = any, TData = any> {
  // Saved config
  config: TConfig;

  // Calculated position info
  width: number;
  height: number;

  // Raw data
  data?: TData;
}

/**
 * Canvas item builder
 *
 * @alpha
 */
export interface CanvasElementItem<TConfig = any, TData = any> extends RegistryItem {
  /** The default width/height to use when adding  */
  defaultSize?: Placement;

  prepareData?: (ctx: DimensionContext, cfg: TConfig) => TData;

  /** Component used to draw */
  display: ComponentType<CanvasElementProps<TConfig, TData>>;

  getNewOptions: (options?: CanvasElementOptions) => Omit<CanvasElementOptions<TConfig>, 'type' | 'name'>;

  /** Build the configuraiton UI */
  registerOptionsUI?: PanelOptionsSupplier<CanvasElementOptions<TConfig>>;
}
