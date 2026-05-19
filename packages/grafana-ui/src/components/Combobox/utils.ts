import { isIconName, type SelectableValue } from '@grafana/data';

import { type ComboboxOption } from './types';

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

/**
 * returns a ComboboxOption from a SelectableValue, or undefined if it could not be converted.
 * @param v - The SelectableValue to convert.
 * @returns The ComboboxOption, or undefined if it could not be converted.
 */
export const selectableValueToComboboxOption = <T extends string | number>(
  v: SelectableValue<T>
): ComboboxOption<T> | undefined => {
  if (v == null || v.value == null) {
    console.warn('selectableValueToComboboxOption: value is null or undefined', v);
    return undefined;
  }
  if (v.icon != null && !isIconName(v.icon)) {
    console.warn('selectableValueToComboboxOption: icon is not a valid icon name', v.icon);
    return undefined;
  }
  return {
    label: v.label,
    value: v.value,
    description: v.description,
    group: v.group,
    infoOption: v.infoOption,
    icon: v.icon,
  };
};
