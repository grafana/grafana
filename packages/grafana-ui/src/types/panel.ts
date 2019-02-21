import { ComponentClass } from 'react';
import { TimeSeries, LoadingState, TableData } from './data';
import { TimeRange } from './time';

export type InterpolateFunction = (value: string, format?: string | Function) => string;

export interface PanelProps<T = any> {
  panelData: PanelData;
  timeRange: TimeRange;
  loading: LoadingState;
  options: T;
  renderCounter: number;
  width: number;
  height: number;
  onInterpolate: InterpolateFunction;
}

export interface PanelData {
  timeSeries?: TimeSeries[];
  tableData?: TableData;
}

export interface PanelEditorProps<T = any> {
  options: T;
  onChange: (options: T) => void;
}

export type PreservePanelOptionsHandler<TOptions = any> = (pluginId: string, prevOptions: any) => Partial<TOptions>;

export class ReactPanelPlugin<TOptions = any> {
  panel: ComponentClass<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  defaults?: TOptions;
  preserveOptions?: PreservePanelOptionsHandler<TOptions>;

  constructor(panel: ComponentClass<PanelProps<TOptions>>) {
    this.panel = panel;
  }

  setEditor(editor: ComponentClass<PanelEditorProps<TOptions>>) {
    this.editor = editor;
  }

  setDefaults(defaults: TOptions) {
    this.defaults = defaults;
  }

  setPreserveOptionsHandler(handler: PreservePanelOptionsHandler<TOptions>) {
    this.preserveOptions = handler;
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
