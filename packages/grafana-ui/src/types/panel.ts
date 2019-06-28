import { ComponentClass, ComponentType } from 'react';
import { LoadingState, SeriesData } from './data';
import { TimeRange } from './time';
import { ScopedVars, DataQueryRequest, DataQueryError, LegacyResponseData } from './datasource';
import { PluginMeta, GrafanaPlugin } from './plugin';

export type InterpolateFunction = (value: string, scopedVars?: ScopedVars, format?: string | Function) => string;

export interface PanelPluginMeta extends PluginMeta {
  skipDataQuery?: boolean;
  hideFromList?: boolean;
  sort: number;
}

export interface PanelData {
  state: LoadingState;
  series: SeriesData[];
  request?: DataQueryRequest;
  error?: DataQueryError;

  // Data format expected by Angular panels
  legacy?: LegacyResponseData[];
}

export interface PanelProps<T = any> {
  id: number; // ID within the current dashboard
  data: PanelData;
  // TODO: annotation?: PanelData;

  timeRange: TimeRange;
  options: T;
  onOptionsChange: (options: T) => void;
  renderCounter: number;
  transparent: boolean;
  width: number;
  height: number;
  replaceVariables: InterpolateFunction;
}

export interface PanelEditorProps<T = any> {
  options: T;
  onOptionsChange: (options: T) => void;
}

export interface PanelModel<TOptions = any> {
  id: number;
  options: TOptions;
  pluginVersion?: string;
}

/**
 * Called when a panel is first loaded with current panel model
 */
export type PanelMigrationHandler<TOptions = any> = (panel: PanelModel<TOptions>) => Partial<TOptions>;

/**
 * Called before a panel is initalized
 */
export type PanelTypeChangedHandler<TOptions = any> = (
  options: Partial<TOptions>,
  prevPluginId: string,
  prevOptions: any
) => Partial<TOptions>;

export class PanelPlugin<TOptions = any> extends GrafanaPlugin<PanelPluginMeta> {
  panel: ComponentType<PanelProps<TOptions>>;
  editor?: ComponentClass<PanelEditorProps<TOptions>>;
  defaults?: TOptions;
  onPanelMigration?: PanelMigrationHandler<TOptions>;
  onPanelTypeChanged?: PanelTypeChangedHandler<TOptions>;

  /**
   * Legacy angular ctrl.  If this exists it will be used instead of the panel
   */
  angularPanelCtrl?: any;

  constructor(panel: ComponentType<PanelProps<TOptions>>) {
    super();
    this.panel = panel;
  }

  setEditor(editor: ComponentClass<PanelEditorProps<TOptions>>) {
    this.editor = editor;
    return this;
  }

  setDefaults(defaults: TOptions) {
    this.defaults = defaults;
    return this;
  }

  /**
   * This function is called before the panel first loads if
   * the current version is different than the version that was saved.
   *
   * This is a good place to support any changes to the options model
   */
  setMigrationHandler(handler: PanelMigrationHandler) {
    this.onPanelMigration = handler;
    return this;
  }

  /**
   * This function is called when the visualization was changed.  This
   * passes in the options that were used in the previous visualization
   */
  setPanelChangeHandler(handler: PanelTypeChangedHandler) {
    this.onPanelTypeChanged = handler;
    return this;
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

export interface DataLink {
  url: string;
  title: string;
  targetBlank?: boolean;
}

export enum VizOrientation {
  Auto = 'auto',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}
