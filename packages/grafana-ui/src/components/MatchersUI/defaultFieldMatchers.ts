import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { fieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { fieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { fieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { readOnlyFieldMatcherItem } from './ReadOnlyFieldMatcherEditor';

export const getDefaultFieldMatchersUI = () => [
  fieldNameMatcherItem,
  fieldNameByRegexMatcherItem,
  fieldTypeMatcherItem,
  fieldsByFrameRefIdItem,
  readOnlyFieldMatcherItem,
];
