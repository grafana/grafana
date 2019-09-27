import { ReactElement } from 'react';
import { SelectableValue } from '@grafana/data';

type ObjectOption<T> = {
  [key: string]: Array<SelectableValue<T>>;
};

export type OptionType<T> = Array<SelectableValue<T>> | ObjectOption<T>;

export interface SegmentProps<T> {
  onChange: (item: SelectableValue<T>) => void;
  currentOption?: SelectableValue<T>;
  Component?: ReactElement; //needs add netter name
}
