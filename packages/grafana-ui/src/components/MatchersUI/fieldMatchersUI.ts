import { Registry } from '@grafana/data';

import { getFieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { getFieldNameMatcherItem } from './FieldNameMatcherEditor';
import { getFieldNamesMatcherItem } from './FieldNamesMatcherEditor';
import { getFieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { getFieldValueMatcherItem } from './FieldValueMatcher';
import { getFieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { FieldMatcherUIRegistryItem } from './types';

export const fieldMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => [
  getFieldNameMatcherItem(),
  getFieldNameByRegexMatcherItem(),
  getFieldTypeMatcherItem(),
  getFieldsByFrameRefIdItem(),
  getFieldNamesMatcherItem(),
  getFieldValueMatcherItem(),
]);
