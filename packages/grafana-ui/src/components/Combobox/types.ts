import { ReactNode } from 'react';

export const ALL_OPTION_VALUE = '__GRAFANA_INTERNAL_MULTICOMBOBOX_ALL_OPTION__';

interface NodeOption {
  node: ReactNode;
  /**
   * text property much exactly match the text in the `node` ReactNode property
   */
  text: string;
  size: number;
}

export type ComboboxOption<T extends string | number = string> = {
  label?: string | NodeOption;
  value: T;
  description?: string;
  group?: string;
  infoOption?: boolean;
};

export interface ComboboxStringOption<T extends string | number = string> {
  label?: string;
  value: T;
  description?: string;
  group?: string;
  infoOption?: boolean;
}
