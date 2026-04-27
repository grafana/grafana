import { type Field } from '@grafana/data/dataframe';
import type { RegistryItem } from '@grafana/data/utils';
import { type MatcherScope } from '@grafana/schema';

export interface ValueMatcherUIRegistryItem<TOptions> extends RegistryItem {
  component: React.ComponentType<ValueMatcherUIProps<TOptions>>;
}

export interface ValueMatcherUIProps<TOptions> {
  options: TOptions;
  onChange: (options: TOptions, scope?: MatcherScope) => void;
  field: Field;
}
export interface ValueMatcherEditorConfig {
  validator: (value: any) => boolean;
  converter?: (value: any, field: Field) => any;
}
