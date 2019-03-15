import { ComponentClass } from 'react';
import { LoadingState, TableData } from './data';
import { TimeRange } from './time';
import { ScopedVars } from './datasource';

export type InterpolateFunction = (value: string, scopedVars?: ScopedVars, format?: string | Function) => string;

export interface PanelProps<T = any> {
  data?: TableData[];
  timeRange: TimeRange;
  loading: LoadingState;
  options: T;
  renderCounter: number;
  width: number;
  height: number;
  replaceVariables: InterpolateFunction;
}

export interface PanelEditorProps<T = any> {
  options: T;
  onOptionsChange: (options: T) => void;
}

/**
 * Called before a panel is initalized
 */
export type PanelTypeChangedHook<TOptions = any> = (
  options: Partial<TOptions>,
  prevPluginId?: string,
  prevOptions?: any
) => Partial<TOptions>;

export class ReactPanelPlugin<TOptions = any> {
  panel: ComponentClass<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  defaults?: TOptions;

  panelTypeChangedHook?: PanelTypeChangedHook<TOptions>;

  constructor(panel: ComponentClass<PanelProps<TOptions>>) {
    this.panel = panel;
  }

  setEditor(editor: ComponentClass<PanelEditorProps<TOptions>>) {
    this.editor = editor;
  }

  setDefaults(defaults: TOptions) {
    this.defaults = defaults;
  }

  /**
   * Called when the visualization changes.
   * Lets you keep whatever settings made sense in the previous panel
   */
  setPanelTypeChangedHook(v: PanelTypeChangedHook<TOptions>) {
    this.panelTypeChangedHook = v;
  }
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelMenuItem {
  type?: 'submenu' | 'divider';
  text?: string;
  iconClassName?: string;
  onClick?: () => void;
  shortcut?: string;
  subMenu?: PanelMenuItem[];
}

export enum MappingType {
  ValueToText = 1,
  RangeToText = 2,
}

interface BaseMap {
  id: number;
  operator: string;
  text: string;
  type: MappingType;
}

export type ValueMapping = ValueMap | RangeMap;

export interface ValueMap extends BaseMap {
  value: string;
}

export interface RangeMap extends BaseMap {
  from: string;
  to: string;
}

export enum VizOrientation {
  Auto = 'auto',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}
