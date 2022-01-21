import { FieldConfigSource } from '@grafana/data';

export interface VizTypeChangeDetails {
  pluginId: string;
  options?: any;
  fieldConfig?: FieldConfigSource;
  withModKey?: boolean;
}
