import { type DataTransformerConfig, type MatcherConfig } from '@grafana/data';

export interface ColumnContext {
  catalog: string[];
  frameFilter?: MatcherConfig;
}

export interface TableTransformation<State = unknown, Value = unknown, Context = unknown> {
  read(configs: readonly DataTransformerConfig[], context: Context): State;
  write(configs: readonly DataTransformerConfig[], value: Value, context: Context): readonly DataTransformerConfig[];
}
