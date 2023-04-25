import { FieldInputAttrs } from '../../../../helpers/types';

export type RadioButtonSize = 'sm' | 'md';

export interface RadioButtonProps {
  checked?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  inputProps?: FieldInputAttrs;
  name: string;
  onChange: () => void;
  size?: RadioButtonSize;
}
