
import * as raw from "../schema/dashboard/dashboard.gen";


export interface DashboardModel extends raw.Dashboard {

}

export interface Panel<TOptions = any, TCustomFieldConfig = any> extends raw.Panel {
  fieldConfig: FieldConfigSource<TCustomFieldConfig>
}

export interface FieldConfig<TOptions = any> extends raw.FieldConfig {
  custom?: TOptions;
}

export interface FieldConfigSource<TOptions = any> extends raw.FieldConfigSource {
  defaults: FieldConfig<TOptions>;
}
