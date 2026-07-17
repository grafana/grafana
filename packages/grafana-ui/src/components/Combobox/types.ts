import { type IconName } from '@grafana/data';

export const ALL_OPTION_VALUE = '__GRAFANA_INTERNAL_MULTICOMBOBOX_ALL_OPTION__';

/**
 * Where an option's description is rendered relative to its label.
 * 'bottom' renders it underneath the label, 'right' renders it right-aligned
 * on the same line, giving a table-like two column layout.
 */
export type ComboboxDescriptionPosition = 'bottom' | 'right';

export type ComboboxOption<T extends string | number = string> = {
  label?: string;
  value: T;
  description?: string;
  group?: string;
  infoOption?: boolean;
  icon?: IconName;
};
