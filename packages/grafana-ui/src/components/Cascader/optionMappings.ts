import { BaseOptionType as RCCascaderOption, CascaderProps } from 'rc-cascader';

import { CascaderOption } from './Cascader';

type onChangeType = ((values: string[], options: CascaderOption[]) => void) | undefined;

export const onChangeCascader =
  (onChanged: onChangeType): CascaderProps['onChange'] =>
  (values, options) => {
    if (onChanged) {
      // map values to strings for backwards compatibility with Cascader components
      onChanged(
        values.map((value) => String(value)),
        fromRCOptions(options)
      );
    }
  };

type onLoadDataType = ((options: CascaderOption[]) => void) | undefined;

export const onLoadDataCascader = (onLoadData: onLoadDataType) => (options: RCCascaderOption[]) => {
  if (onLoadData) {
    onLoadData(fromRCOptions(options));
  }
};

const fromRCOptions = (options: RCCascaderOption[]): CascaderOption[] => {
  return options.map(fromRCOption);
};

const fromRCOption = (option: RCCascaderOption): CascaderOption => {
  const value = option.value ? String(option.value) : '';
  return {
    value,
    label: typeof option.label === 'string' ? option.label : value,
  };
};
