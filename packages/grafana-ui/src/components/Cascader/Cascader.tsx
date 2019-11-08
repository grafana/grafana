import React from 'react';

// @ts-ignore
import RCCascader from 'rc-cascader';

export interface AlignType {
  points?: string[];
  offset?: number[];
  targetOffset?: number[];
  overflow?: {
    adjustX?: boolean | number;
    adjustY?: boolean | number;
  };
  useCssRight?: boolean;
  useCssBottom?: boolean;
  useCssTransform?: boolean;
}

export interface BuiltInPlacements {
  [placement: string]: AlignType;
}

export interface CascaderOption {
  label: string;
  value: string;

  children?: CascaderOption[];
  disabled?: boolean;
}

export interface CascaderProps {
  options: CascaderOption[];
  buttonText: string;

  builtinPlacements?: BuiltInPlacements;
  changeOnSelect?: boolean;
  defaultValue?: string[];
  disabled?: boolean;
  dropdownMenuColumnStyle?: React.CSSProperties;
  expandIcon?: React.ReactNode;
  expandTrigger?: string;
  popupPlacement?: string;
  popupVisible?: boolean;
  value?: string[];

  getPopupContainer?: (trigger: React.ReactNode) => React.ReactNode;
  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onKeyDown?: () => void;
  onPopupVisibleChange?: (visible: boolean) => void;
}

export const Cascader: React.FC<CascaderProps> = props => (
  <RCCascader {...props}>
    <button className="gf-form-label gf-form-label--btn" disabled={props.disabled}>
      {props.buttonText} <i className="fa fa-caret-down" />
    </button>
  </RCCascader>
);
