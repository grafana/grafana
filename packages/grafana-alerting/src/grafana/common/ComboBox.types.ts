import { type ComponentProps } from 'react';

import { type Combobox } from '@grafana/ui';

interface ClearableProps<T> {
  isClearable: true;
  onChange: (option: T | null) => void;
}

interface NotClearableProps<T> {
  isClearable?: false;
  onChange: (option: T) => void;
}

type ComboboxClearableProps<T> = NotClearableProps<T> | ClearableProps<T>;

// This mirrors Combobox's own width props on purpose. The Omit below runs over a union,
// which TypeScript collapses into a single object type, so without re-stating these here
// you could pass width="auto" with no minWidth and get no error.
// Only the single Combobox is built from this type, and it reads minWidth/maxWidth only
// when width is "auto" - hence never on the other branch.
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
