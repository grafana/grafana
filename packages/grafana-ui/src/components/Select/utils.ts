import { SelectableValue } from '@grafana/data';
import { SelectOptions } from './types';

/**
 * Normalize the value format to SelectableValue[] | []. Only used for single select
 */
export const cleanValue = (value: any, options: SelectOptions): SelectableValue[] | [] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === 'object' && value !== null) {
    return [value];
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const selectedValue = findSelectedValue(value, options);
    if (selectedValue) {
      return [selectedValue];
    }
  }
  return [];
};

/**
 * Find the label for a string|number value inside array of options or optgroups
 */
export const findSelectedValue = (value: string | number, options: SelectOptions): SelectableValue | null => {
  for (const option of options) {
    if ('options' in option) {
      let found = findSelectedValue(value, option.options);
      if (found) {
        return found;
      }
    } else if ('value' in option && option.value === value) {
      return option;
    }
  }

  return null;
};
