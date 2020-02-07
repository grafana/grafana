import { ComponentClass, ComponentType } from 'react';
import { DataQueryError, DataQueryRequest } from './datasource';
import { GrafanaPlugin, PluginMeta } from './plugin';
import { ScopedVars } from './ScopedVars';
import { LoadingState } from './data';
import { DataFrame } from './dataFrame';
import { AbsoluteTimeRange, TimeRange, TimeZone } from './time';

export type InterpolateFunction = (value: string, scopedVars?: ScopedVars, format?: string | Function) => string;

export interface PanelPluginMeta extends PluginMeta {
  skipDataQuery?: boolean;
  hideFromList?: boolean;
  sort: number;
}

export interface PanelData {
  state: LoadingState;
  series: DataFrame[];
  request?: DataQueryRequest;
  error?: DataQueryError;
  // Contains the range from the request or a shifted time range if a request uses relative time
  timeRange: TimeRange;
}

export interface PanelProps<T = any> {
  id: number; // ID within the current dashboard
  data: PanelData;
  timeRange: TimeRange;
  timeZone: TimeZone;
  options: T;
  onOptionsChange: (options: T) => void;
  renderCounter: number;
  transparent: boolean;
  width: number;
  height: number;
  replaceVariables: InterpolateFunction;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

export interface PanelEditorProps<T = any> {
  options: T;
  onOptionsChange: (
    options: T,
    // callback can be used to run something right after update.
    callback?: () => void
  ) => void;
  data: PanelData;
}

export interface PanelModel<TOptions = any> {
  id: number;
  options: TOptions;
  pluginVersion?: string;
  scopedVars?: ScopedVars;
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
  noPadding?: boolean;

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

  setNoPadding() {
    this.noPadding = true;
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

export interface PanelMenuItem {
  type?: 'submenu' | 'divider';
  text?: string;
  iconClassName?: string;
  onClick?: (event: React.MouseEvent<any>) => void;
  shortcut?: string;
  subMenu?: PanelMenuItem[];
}

export interface AngularPanelMenuItem {
  click: Function;
  icon: string;
  href: string;
  divider: boolean;
  text: string;
  shortcut: string;
  submenu: any[];
}

export enum VizOrientation {
  Auto = 'auto',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}
