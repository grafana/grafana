export const ALL_OPTION_VALUE = '__GRAFANA_INTERNAL_MULTICOMBOBOX_ALL_OPTION__';

export type ComboboxOption<T extends string | number = string> = {
  label?: string;
  value: T;
  description?: string;
  group?: string;
};
