import { ComponentProps } from 'react';

import { Combobox } from '@grafana/ui';

interface ClearableProps<T> {
  isClearable: true;
  onChange: (option: T | null) => void;
}

interface NotClearableProps<T> {
  isClearable?: false;
  onChange: (option: T) => void;
}

type ComboboxClearableProps<T> = NotClearableProps<T> | ClearableProps<T>;

type AutoSizeConditionals =
  | {
      width: 'auto';
      minWidth: number;
      maxWidth?: number;
    }
  | {
      width?: number;
      minWidth?: never;
      maxWidth?: never;
    };

export type CustomComboBoxProps<T> = Omit<ComponentProps<typeof Combobox<string>>, 'options' | 'loading' | 'onChange'> &
  ComboboxClearableProps<T> &
  AutoSizeConditionals;
