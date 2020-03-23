import React from 'react';
import { Icon } from '../Icon/Icon';
import { css } from 'emotion';

// @ts-ignore
import RCCascader from 'rc-cascader';
import { CascaderOption } from '../Cascader/Cascader';
import { stylesFactory } from '../../themes';

export interface ButtonCascaderProps {
  options: CascaderOption[];
  children: string;
  disabled?: boolean;
  value?: string[];
  fieldNames?: { label: string; value: string; children: string };

  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
}

const getStyles = stylesFactory(() => {
  return {
    popup: css`
      label: popup;
      z-index: 100;
    `,
  };
});

export const ButtonCascader: React.FC<ButtonCascaderProps> = props => (
  <RCCascader popupClassName={getStyles().popup} {...props} expandIcon={null}>
    <button className="gf-form-label gf-form-label--btn" disabled={props.disabled}>
      {props.children} <Icon name="caret-down" />
    </button>
  </RCCascader>
);
