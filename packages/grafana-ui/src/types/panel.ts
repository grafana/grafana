import { ComponentClass } from 'react';
import { TimeSeries, LoadingState, TableData } from './data';
import { TimeRange } from './time';
import { ScopedVars } from './datasource';

export type InterpolateFunction = (value: string, scopedVars?: ScopedVars, format?: string | Function) => string;

export interface PanelProps<T = any> {
  panelData: PanelData;
  timeRange: TimeRange;
  loading: LoadingState;
  options: T;
  renderCounter: number;
  width: number;
  height: number;
  replaceVariables: InterpolateFunction;
}

export interface PanelData {
  timeSeries?: TimeSeries[];
  tableData?: TableData;
}

export interface PanelEditorProps<T = any> {
  options: T;
  onOptionsChange: (options: T) => void;
}

/**
 * Checks the existing model before the component is loaded
 * This is useful for fixing options as configuration changes
 * The object passed in is the panel model.... but not typed
 * since that is not in grafana ui
 */
export type PanelOptionsValidator<T = any> = (panelModel: any) => T;

export class ReactPanelPlugin<TOptions = any> {
  panel: ComponentClass<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  optionsValidator?: PanelOptionsValidator<TOptions>;
  defaults?: TOptions;

  constructor(panel: ComponentClass<PanelProps<TOptions>>) {
    this.panel = panel;
  }

  setEditor(editor: ComponentClass<PanelEditorProps<TOptions>>) {
    this.editor = editor;
  }

  setOptionsValidator(validator: PanelOptionsValidator<TOptions>) {
    this.optionsValidator = validator;
  }

  setDefaults(defaults: TOptions) {
    this.defaults = defaults;
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

export interface Threshold {
  index: number;
  value: number;
  color: string;
}

export enum BasicGaugeColor {
  Green = '#299c46',
  Red = '#d44a3a',
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
