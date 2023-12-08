import { PropsWithChildren } from 'react';

import { FieldInputAttrs } from '../../../../helpers/types';

export type RadioButtonSize = 'sm' | 'md';

export interface RadioButtonProps extends PropsWithChildren {
  checked?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  inputProps?: FieldInputAttrs;
  name: string;
  onChange: () => void;
  size?: RadioButtonSize;
}
