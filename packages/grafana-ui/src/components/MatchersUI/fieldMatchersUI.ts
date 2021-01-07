import { Registry } from '@grafana/data';
import { FieldMatcherUIRegistryItem } from './types';
import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { fieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { fieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { fieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { fieldNamesMatcherItem } from './FieldNamesMatcherEditor';
import { firstFieldsMatcherItem } from './FirstFieldMatcherEditor';
import { numericFieldsMatcherItem } from './NumericFieldMatcherEditor';

const matchers = [
  fieldNameMatcherItem,
  fieldNameByRegexMatcherItem,
  fieldTypeMatcherItem,
  fieldsByFrameRefIdItem,
  fieldNamesMatcherItem,
];

export const fieldMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => matchers);

/**
 * Use for dimension mapping
 *
 * @alpha
 */
export const fieldDimensionMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => {
  return [firstFieldsMatcherItem, numericFieldsMatcherItem, ...matchers];
});
