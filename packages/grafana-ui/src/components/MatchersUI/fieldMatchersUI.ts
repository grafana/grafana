import { Registry } from '@grafana/data';
import { FieldMatcherUIRegistryItem } from './types';
import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { fieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { fieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { firstFieldsMatcherItem } from './FirstFieldMatcherEditor';
import { numericFieldsMatcherItem } from './NumericFieldMatcherEditor';

// Used for field overrides
export const fieldMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => {
  return [fieldNameMatcherItem, fieldNameByRegexMatcherItem, fieldTypeMatcherItem];
});

/**
 * Use for dimension mapping
 *
 * @alpha
 */
export const fieldDimensionMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => {
  return [
    firstFieldsMatcherItem,
    numericFieldsMatcherItem,
    fieldNameMatcherItem,
    fieldNameByRegexMatcherItem,
    fieldTypeMatcherItem,
  ];
});
