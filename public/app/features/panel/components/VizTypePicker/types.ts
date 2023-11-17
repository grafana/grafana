import { FieldConfigSource } from '@grafana/data';

export interface VizTypeChangeDetails {
  pluginId: string;
  options?: Record<string, unknown>;
  fieldConfig?: FieldConfigSource;
  withModKey?: boolean;
}
