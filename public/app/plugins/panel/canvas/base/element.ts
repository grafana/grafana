import { ComponentType } from 'react';
import { RegistryItemWithOptions, PanelOptionsEditorBuilder, PanelData } from '@grafana/data';
import { Anchor, BackgroundConfig, LineConfig, Placement } from './types';

/**
 * This gets saved in panel json
 *
 * depending on the type, it may have additional config
 *
 * @alpha
 */
export interface CanvasElementOptions<TConfig = any> {
  type: string;

  // Custom options depending on the type
  config?: TConfig;

  // Standard options avaliable for all elements
  anchor?: Anchor; // defaults top, left, width and height
  placement?: Placement;
  background?: BackgroundConfig;
  border?: LineConfig;
}

export interface CanvasGroupOptions extends CanvasElementOptions {
  type: 'group';
  elements: CanvasElementOptions[];
  // layout? // absolute, list, grid?
}

export interface CanvasElementProps<TConfig = any> {
  // Saved config
  config: TConfig;

  // Calculated position info
  width: number;
  height: number;

  // Raw data
  data?: PanelData; // TOO much info! better if we can limit to dimensions (•_•)
}

/**
 * Canvas item builder
 *
 * @alpha
 */
export interface CanvasElementItem<TConfig = any> extends RegistryItemWithOptions {
  /** The default width/height to use when adding  */
  defaultSize?: Placement;

  /** Component used to draw */
  display: ComponentType<CanvasElementProps<TConfig>>;

  /** Build the configuraiton UI */
  registerOptionsUI?: (builder: PanelOptionsEditorBuilder<CanvasElementOptions<TConfig>>) => void;
}
