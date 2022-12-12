import * as raw from '../raw/dashboard/x/dashboard_types.gen';

export interface Dashboard extends raw.Dashboard {
  panels?: Array<
    | Panel
    | raw.RowPanel
    | {
        type: 'graph';
      }
    | {
        type: 'heatmap';
      }
  >;
}

export interface Panel<TOptions = Record<string, unknown>, TCustomFieldConfig = Record<string, unknown>>
  extends raw.Panel {
  fieldConfig: FieldConfigSource<TCustomFieldConfig>;
}

export interface FieldConfig<TOptions = Record<string, unknown>> extends raw.FieldConfig {
  custom?: TOptions & Record<string, unknown>;
}

export interface FieldConfigSource<TOptions = Record<string, unknown>> extends raw.FieldConfigSource {
  defaults: FieldConfig<TOptions>;
}

export const defaultDashboard: Partial<Dashboard> = raw.defaultDashboard;
export const defaultPanel: Partial<Panel> = raw.defaultPanel;
export const defaultFieldConfig: Partial<FieldConfig> = raw.defaultFieldConfig;
export const defaultFieldConfigSource: Partial<FieldConfigSource> = raw.defaultFieldConfigSource;
