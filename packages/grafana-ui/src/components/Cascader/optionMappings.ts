import { CascaderOption as RCCascaderOption } from 'rc-cascader/lib/Cascader';
import { CascaderOption } from './Cascader';

type onChangeType = ((values: string[], options: CascaderOption[]) => void) | undefined;

export const onChangeCascader = (onChanged: onChangeType) => (values: string[], options: RCCascaderOption[]) => {
  if (onChanged) {
    onChanged(values, fromRCOptions(options));
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
    label: (option.label as unknown) as string,
  };
};
