import { type DataTransformerConfig, type MatcherConfig } from '@grafana/data';

export interface ColumnContext {
  catalog: string[];
  frameFilter?: MatcherConfig;
}

export interface TableTransformation<State, Value, Context> {
  read(configs: readonly DataTransformerConfig[], context: Context): State;
  write(configs: readonly DataTransformerConfig[], value: Value, context: Context): readonly DataTransformerConfig[];
}
