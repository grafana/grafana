
import {
  FieldConfig as SchemaFieldConfig,
  Dashboard as SchemaDashboard,
  Panel as SchemaPanel,
} from "../schema/dashboard";

export interface FieldConfig<TOptions = any> extends SchemaFieldConfig {
  defaults: {
    custom: TOptions;
  }
}

export interface Panel<TOptions = any> extends SchemaPanel {
  fieldConfig: FieldConfig<TOptions>
}

export interface Dashboard extends SchemaDashboard {
  panels: Panel[]
}
