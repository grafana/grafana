import { ReactNode } from 'react';
import { ButtonSize } from '../Button/AbstractButton';

export interface ToggleButtonState {
  untouched: boolean;
  selected: boolean;
  value?: any;
}

export interface ToggleButtonProps {
  onChange?: (value: any) => void;
  selected: boolean;
  value?: any;
  className?: string;
  children: ReactNode;
  tooltip?: string;
  key?: any;
  size?: ButtonSize;
}

export interface ToggleButtonGroupProps {
  label?: string;
  children: JSX.Element[];
  transparent?: boolean;
  active?: number;
}
