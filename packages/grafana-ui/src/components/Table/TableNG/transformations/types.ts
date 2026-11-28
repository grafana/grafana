import { type DataTransformerConfig, type MatcherConfig } from '@grafana/data';
import { type FieldReference } from '@grafana/data/internal';

export interface ColumnContext {
  catalog: string[];
  displayNames?: string[];
  references: FieldReference[];
  frameFilter?: MatcherConfig;
}

export interface TableTransformation<State = unknown, Value = unknown, Context = unknown> {
  read(configs: readonly DataTransformerConfig[], context: Context): State;
  write(configs: readonly DataTransformerConfig[], value: Value, context: Context): readonly DataTransformerConfig[];
}
