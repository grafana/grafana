import { SelectableValue } from '@grafana/data';
import { SelectOptions } from './types';

/**
 * Normalize the value format to SelectableValue[] | []. Only used for single select
 */
export const cleanValue = (value: any, options: SelectOptions<string>): SelectableValue[] | [] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === 'object' && value !== null) {
    return [value];
  }
  if (typeof value === 'string') {
    return findSelectedValue(value, options);
  }
  return [];
};

/**
 * Find the label for a string value inside array of options or optgroups
 */
export const findSelectedValue = (value: string, options: SelectOptions): SelectableValue[] | [] => {
  let found = null;

  for (const option of options) {
    if (option.options) {
      found = findSelectedValue(value, option.options);
    } else if (option.value === value || option === value) {
      found = option;
    }

    if (found) {
      return [found];
    }
  }
  return [];
};
