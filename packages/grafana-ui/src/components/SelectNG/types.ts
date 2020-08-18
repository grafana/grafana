import { SelectableValue } from '@grafana/data';
import { Placement } from '@popperjs/core';

export interface SelectNGProps<T> {
  value?: SelectableValue<T> | null;
  options: Array<SelectableValue<T>>;
  placeholder?: string;
  placement?: Placement; // previously menuPlacement
  width?: number;
  onChange: (value: SelectableValue<T> | null) => void;
  disabled?: boolean;
  clearable?: boolean;
  filterable?: boolean;
  noOptionsMessage?: string;
}

export interface AsyncSelectNGProps<T> extends Omit<SelectNGProps<T>, 'options'> {
  loadOptions: AsyncSelectOptionsResolver<T>;
  loadingMessage?: string;
  errorMessage?: string;
}

export type AsyncSelectOptionsResolver<T> = (query: string | null) => Promise<Array<SelectableValue<T>>>;
