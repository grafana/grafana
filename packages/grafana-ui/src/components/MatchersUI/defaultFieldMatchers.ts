import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { fieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { fieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { fieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { readOnlyFieldMatcherItem } from './FieldReadOnlyMatcherDecorator';
import { fieldNamesMatcherItem } from './FieldNamesMatcherEditor';

export const getDefaultFieldMatchersUI = () => [
  fieldNameMatcherItem,
  fieldNameByRegexMatcherItem,
  fieldTypeMatcherItem,
  fieldsByFrameRefIdItem,
  fieldNamesMatcherItem,
  readOnlyFieldMatcherItem,
];
