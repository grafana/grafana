import { SelectableValue } from '@grafana/data';

type ObjectOption<T> = {
  [key: string]: Array<SelectableValue<T>>;
};

export type OptionType<T> = Array<SelectableValue<T>> | ObjectOption<T>;
