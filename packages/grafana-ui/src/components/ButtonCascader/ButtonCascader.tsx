import React from 'react';
import { Icon } from '../Icon/Icon';

// @ts-ignore
import RCCascader from 'rc-cascader';
import { CascaderOption } from '../Cascader/Cascader';
import { onChangeCascader, onLoadDataCascader } from '../Cascader/optionMappings';

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

export const ButtonCascader: React.FC<ButtonCascaderProps> = props => {
  const { onChange, loadData, ...rest } = props;
  return (
    <RCCascader
      onChange={onChangeCascader(onChange)}
      loadData={onLoadDataCascader(loadData)}
      {...rest}
      expandIcon={null}
    >
      <button className="gf-form-label gf-form-label--btn" disabled={props.disabled}>
        {props.children} <Icon name="caret-down" />
      </button>
    </RCCascader>
  );
};
