import React from 'react';

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
    <button className="gf-form-label gf-form-label--btn" disabled={props.disabled}>
      {props.buttonText} <i className="fa fa-caret-down" />
    </button>
  </RCCascader>
);
