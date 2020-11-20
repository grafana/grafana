import { Field, RegistryItem } from '@grafana/data';

export interface ValueMatcherUIRegistryItem<TOptions> extends RegistryItem {
  component: React.ComponentType<ValueMatcherUIProps<TOptions>>;
}

export interface ValueMatcherUIProps<TOptions> {
  options: TOptions;
  onChange: (options: TOptions) => void;
  field: Field;
}

export type ValueMatcherValidator<TOption> = (options: TOption) => boolean;
