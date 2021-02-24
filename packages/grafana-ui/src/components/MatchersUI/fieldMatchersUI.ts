import { Registry } from '@grafana/data';
import { FieldMatcherUIRegistryItem } from './types';
import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { fieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { fieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { fieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { fieldNamesMatcherItem } from './FieldNamesMatcherEditor';

export const fieldMatchersUI = new Registry<FieldMatcherUIRegistryItem<any>>(() => [
  fieldNameMatcherItem,
  fieldNameByRegexMatcherItem,
  fieldTypeMatcherItem,
  fieldsByFrameRefIdItem,
  fieldNamesMatcherItem,
]);
