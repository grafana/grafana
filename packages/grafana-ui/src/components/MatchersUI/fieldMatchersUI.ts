import { useMemo } from 'react';

import type { SelectableValue } from '@grafana/data/types';
import { Registry } from '@grafana/data/utils';

import { type ComboboxOption } from '../Combobox/types';
import { selectableValueToComboboxOption } from '../Combobox/utils';

import { getFieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { getFieldNameMatcherItem } from './FieldNameMatcherEditor';
import { getFieldNamesMatcherItem } from './FieldNamesMatcherEditor';
import { getFieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { getFieldValueMatcherItem } from './FieldValueMatcher';
import { getFieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { type FieldMatcherUIRegistryItem } from './types';

export const fieldMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => [
  getFieldNameMatcherItem(),
  getFieldNameByRegexMatcherItem(),
  getFieldTypeMatcherItem(),
  getFieldsByFrameRefIdItem(),
  getFieldNamesMatcherItem(),
  getFieldValueMatcherItem(),
]);

export function useFieldMatchersOptions(asComboboxOptions: true): Array<ComboboxOption<string>>;
export function useFieldMatchersOptions(asComboboxOptions: false): Array<SelectableValue<string>>;
export function useFieldMatchersOptions(asComboboxOptions?: undefined): Array<SelectableValue<string>>;
export function useFieldMatchersOptions(
  asComboboxOptions: boolean
): Array<ComboboxOption<string>> | Array<SelectableValue<string>>;
export function useFieldMatchersOptions(asComboboxOptions?: boolean) {
  return useMemo(() => {
    const selectableValues = fieldMatchersUI.selectOptions().options;
    if (asComboboxOptions) {
      return selectableValues.map(selectableValueToComboboxOption).filter((v) => !!v);
    }
    return selectableValues;
  }, [asComboboxOptions]);
}
