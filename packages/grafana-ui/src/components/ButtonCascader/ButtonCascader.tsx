import React from 'react';
import { Button } from '../Forms/Button';
import { Icon } from '../Icon/Icon';

// @ts-ignore
import RCCascader from 'rc-cascader';
import { CascaderOption } from '../Cascader/Cascader';

export interface ButtonCascaderProps {
  options: CascaderOption[];
  buttonText: string;
  disabled?: boolean;
  expandIcon?: React.ReactNode;
  value?: string[];

  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
}

export const ButtonCascader: React.FC<ButtonCascaderProps> = props => (
  <RCCascader {...props} fieldNames={{ label: 'label', value: 'value', children: 'items' }}>
    <Button variant="secondary" disabled={props.disabled}>
      {props.buttonText} <Icon name="caret-down" />
    </Button>
  </RCCascader>
);
