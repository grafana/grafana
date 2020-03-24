import { CascaderOption as RCCascaderOption } from 'rc-cascader/lib/Cascader';
import { CascaderOption } from './Cascader';

export const onChangeCascader = (onCascaderOptionChanged: onChangeType) => (
  values: string[],
  options: RCCascaderOption[]
) => {
  if (onCascaderOptionChanged) {
    onCascaderOptionChanged(values, fromRCOptions(options));
  }
};
type onChangeType = ((values: string[], options: CascaderOption[]) => void) | undefined;

export const fromRCOptions = (options: RCCascaderOption[]): CascaderOption[] => {
  return options.map(fromRCOption);
};
export const fromRCOption = (option: RCCascaderOption): CascaderOption => {
  return {
    value: option.value ?? '',
    label: (option.label as unknown) as string,
  };
};
