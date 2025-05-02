import { ComboboxOption } from './types';

export const isNewGroup = <T extends string | number>(option: ComboboxOption<T>, prevOption?: ComboboxOption<T>) => {
  const currentGroup = option.group;

  if (!currentGroup) {
    return prevOption?.group ? true : false;
  }

  if (!prevOption) {
    return true;
  }

  return prevOption.group !== currentGroup;
};
