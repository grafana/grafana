import { type IconName } from '@grafana/data';

export const ALL_OPTION_VALUE = '__GRAFANA_INTERNAL_MULTICOMBOBOX_ALL_OPTION__';

export type ComboboxOption<T extends string | number = string> = {
  label?: string;
  value: T;
  description?: string;
  group?: string;
  infoOption?: boolean;
  icon?: IconName;
};

/**
 * Passed to an async options loader. `publish` replaces the open menu before the
 * returned promise settles. Pass the full list so far. A newer search ignores
 * publishes from an older one, and `signal` aborts when that search is replaced,
 * the menu closes, or the combobox unmounts.
 */
export interface ComboboxAsyncOptionsContext<T extends string | number = string> {
  signal: AbortSignal;
  publish: (options: Array<ComboboxOption<T>>) => void;
}
