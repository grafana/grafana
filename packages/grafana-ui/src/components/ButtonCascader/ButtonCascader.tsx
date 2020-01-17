import React from 'react';
import { Button } from '../Forms/Button';
import { Icon } from '../Icon/Icon';

// @ts-ignore
import RCCascader from 'rc-cascader';
import { CascaderOption } from '../Cascader/Cascader';

export interface ButtonCascaderProps {
  options: CascaderOption[];
  children: string;
  disabled?: boolean;
  value?: string[];

  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
}

export const ButtonCascader: React.FC<ButtonCascaderProps> = props => (
  <RCCascader {...props} fieldNames={{ label: 'label', value: 'value', children: 'items' }} expandIcon={null}>
    <Button variant="secondary" disabled={props.disabled}>
      {props.children} <Icon name="caret-down" />
    </Button>
  </RCCascader>
);
