import React from 'react';
import { Button } from '../Forms/Button';
import { Icon } from '../Icon/Icon';

// @ts-ignore
import RCCascader from 'rc-cascader';

export interface ButtonCascaderOption {
  label: string;
  value: string;

  children?: ButtonCascaderOption[];
  disabled?: boolean;
  // Undocumented tooltip API
  title?: string;
}

export interface ButtonCascaderProps {
  options: ButtonCascaderOption[];
  buttonText: string;
  disabled?: boolean;
  expandIcon?: React.ReactNode;
  value?: string[];

  loadData?: (selectedOptions: ButtonCascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: ButtonCascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
}

export const ButtonCascader: React.FC<ButtonCascaderProps> = props => (
  <RCCascader {...props}>
    <Button variant="secondary" disabled={props.disabled}>
      {props.buttonText} <Icon name="caret-down" />
    </Button>
  </RCCascader>
);
