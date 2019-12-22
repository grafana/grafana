import React from 'react';

// @ts-ignore
import RCCascader from 'rc-cascader';

export interface CascaderOption {
  label: string;
  value: string;

  children?: CascaderOption[];
  disabled?: boolean;
  // Undocumented tooltip API
  title?: string;
}

export interface CascaderProps {
  options: CascaderOption[];
  buttonText: string;
  disabled?: boolean;
  expandIcon?: React.ReactNode;
  value?: string[];

  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
}

export const Cascader: React.FC<CascaderProps> = props => (
  <RCCascader {...props}>
    <button className="gf-form-label gf-form-label--btn" disabled={props.disabled}>
      {props.buttonText} <i className="fa fa-caret-down" />
    </button>
  </RCCascader>
);
