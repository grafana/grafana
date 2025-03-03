import { ComponentType } from 'react';

import { DataLink, RegistryItem, Action } from '@grafana/data';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import { ColorDimensionConfig, ScaleDimensionConfig } from '@grafana/schema';
import { config } from 'app/core/config';
import { BackgroundConfig, Constraint, LineConfig, Placement } from 'app/plugins/panel/canvas/panelcfg.gen';

import { LineStyleConfig } from '../../plugins/panel/canvas/editor/LineStyleEditor';
import { DimensionContext } from '../dimensions';

import { StandardEditorConfig } from './types';

/**
 * This gets saved in panel json
 *
 * depending on the type, it may have additional config
 *
 * @alpha
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CanvasElementOptions<TConfig = any> {
  name: string; // configured unique display name
  type: string;

  // Custom options depending on the type
  config?: TConfig;

  // Standard options available for all elements
  constraint?: Constraint; // defaults vertical - top, horizontal - left
  placement?: Placement;
  background?: BackgroundConfig;
  border?: LineConfig;
  connections?: CanvasConnection[];
  links?: DataLink[];
  actions?: Action[];
}

// Unit is percentage from the middle of the element
// 0, 0 middle; -1, -1 bottom left; 1, 1 top right
export interface ConnectionCoordinates {
  x: number;
  y: number;
}

export enum ConnectionPath {
  Straight = 'straight',
}

export enum ConnectionDirection {
  Forward = 'forward',
  Reverse = 'reverse',
  Both = 'both',
  None = 'none',
}

export interface CanvasConnection {
  source: ConnectionCoordinates;
  target: ConnectionCoordinates;
  targetName?: string;
  path: ConnectionPath;
  color?: ColorDimensionConfig;
  size?: ScaleDimensionConfig;
  lineStyle?: LineStyleConfig;
  vertices?: ConnectionCoordinates[];
  radius?: ScaleDimensionConfig;
  direction?: ConnectionDirection;
  sourceOriginal?: ConnectionCoordinates;
  targetOriginal?: ConnectionCoordinates;
  // See https://github.com/anseki/leader-line#options for more examples of more properties
}

export interface CanvasElementProps<TConfig = unknown, TData = unknown> {
  // Saved config
  config: TConfig;

  // Raw data
  data?: TData;

  // If the element is currently selected
  isSelected?: boolean;
}

/**
 * Canvas item builder
 *
 * @alpha
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CanvasElementItem<TConfig = any, TData = any> extends RegistryItem {
  /** The default width/height to use when adding  */
  defaultSize?: Placement;

  prepareData?: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<TConfig>) => TData;

  /** Component used to draw */
  display: ComponentType<CanvasElementProps<TConfig, TData>>;

  getNewOptions: (options?: CanvasElementOptions) => Omit<CanvasElementOptions<TConfig>, 'type' | 'name'>;

  /** Build the configuration UI */
  registerOptionsUI?: PanelOptionsSupplier<CanvasElementOptions<TConfig>>;

  /** If item has an edit mode */
  hasEditMode?: boolean;

  /** Optional config to customize what standard element editor options are available for the item */
  standardEditorConfig?: StandardEditorConfig;

  /** Custom connection anchor coordinates, like for svg elements such as triangle, cloud, etc */
  customConnectionAnchors?: Array<{
    x: number;
    y: number;
  }>;
}

export const defaultBgColor = '#D9D9D9';
export const defaultTextColor = '#000000';
export const defaultLightTextColor = '#F0F4FD';
export const defaultThemeTextColor = config.theme2.colors.text.primary;
