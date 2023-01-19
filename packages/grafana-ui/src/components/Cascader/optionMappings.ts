import { SingleValueType, BaseOptionType as RCCascaderOption } from 'rc-cascader/lib/Cascader';

import { CascaderOption } from './Cascader';

type onChangeType = ((values: string[], options: CascaderOption[]) => void) | undefined;

export const onChangeCascader = (onChanged: onChangeType) => (values: SingleValueType, options: RCCascaderOption[]) => {
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
  return {
    value: option.value ?? '',
    label: option.label,
  };
};
