import { fieldMatchersUI } from './fieldMatchersUI';
import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { fieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { fieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { fieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { readOnlyFieldMatcherItem } from './ReadOnlyFieldMatcherEditor';

fieldMatchersUI.register(fieldNameMatcherItem);
fieldMatchersUI.register(fieldNameByRegexMatcherItem);
fieldMatchersUI.register(fieldTypeMatcherItem);
fieldMatchersUI.register(fieldsByFrameRefIdItem);
fieldMatchersUI.register(readOnlyFieldMatcherItem);
