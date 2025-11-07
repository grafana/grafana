import { FieldConfigSource } from '@grafana/data';

export interface VizTypeChangeDetails<Options extends {} = {}, TFieldConfig extends {} = {}> {
  pluginId: string;
  options?: Partial<Options>;
  fieldConfig?: FieldConfigSource<Partial<TFieldConfig>>;
  withModKey?: boolean;
}
