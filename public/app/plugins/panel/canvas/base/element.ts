import { ComponentType } from 'react';
import { RegistryItemWithOptions, PanelOptionsEditorBuilder } from '@grafana/data';
import { Anchor, BackgroundConfig, LineConfig, Placement } from './types';
import {
  ColorDimensionConfig,
  DimensionSupplier,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
} from '../../geomap/dims/types';

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

export interface CanvasElementProps<TConfig = any, TData = any> {
  // Saved config
  config: TConfig;

  // Calculated position info
  width: number;
  height: number;

  // Raw data
  data?: TData;
}

export interface CanvasSceneContext {
  getColor(color: ColorDimensionConfig): DimensionSupplier<string>;
  getScale(scale: ScaleDimensionConfig): DimensionSupplier<number>;
  getResource(resource: ResourceDimensionConfig): DimensionSupplier<string>;
}

/**
 * Canvas item builder
 *
 * @alpha
 */
export interface CanvasElementItem<TConfig = any, TData = any> extends RegistryItemWithOptions {
  /** The default width/height to use when adding  */
  defaultSize?: Placement;

  prepareData?: (ctx: CanvasSceneContext, cfg: TConfig) => TData;

  /** Component used to draw */
  display: ComponentType<CanvasElementProps<TConfig, TData>>;

  /** Build the configuraiton UI */
  registerOptionsUI?: (builder: PanelOptionsEditorBuilder<CanvasElementOptions<TConfig>>) => void;
}
