import { ReactNode } from 'react';

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
  untouched?: boolean;
}

export interface ToggleButtonGroupProps {
  label?: string;
  children: JSX.Element[];
  transparent?: boolean;
  active?: number;
}
