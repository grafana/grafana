import { FieldConfigSource } from './fieldOverrides';
import { DataQuery, DataSourceRef } from './query';

export enum DashboardCursorSync {
  Off,
  Crosshair,
  Tooltip,
}

/**
 * @public
 */
export interface PanelModel<TOptions = any, TCustomFieldConfig = any> {
  /** ID of the panel within the current dashboard */
  id: number;

  /** The panel type */
  type: string;

  /** Panel title */
  title?: string;

  /** Description */
  description?: string;

  /** Panel options */
  options: TOptions;

  /** Field options configuration */
  fieldConfig: FieldConfigSource<TCustomFieldConfig>;

  /** Version of the panel plugin */
  pluginVersion?: string;

  /** The datasource used in all targets */
  datasource?: DataSourceRef | null;

  /** The queries in a panel */
  targets?: DataQuery[];

  /** alerting v1 object */
  alert?: any;
}
