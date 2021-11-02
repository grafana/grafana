import { Registry } from '@grafana/data';
import { fieldNameMatcherItem } from './FieldNameMatcherEditor';
import { fieldNameByRegexMatcherItem } from './FieldNameByRegexMatcherEditor';
import { fieldTypeMatcherItem } from './FieldTypeMatcherEditor';
import { fieldsByFrameRefIdItem } from './FieldsByFrameRefIdMatcher';
import { fieldNamesMatcherItem } from './FieldNamesMatcherEditor';
export var fieldMatchersUI = new Registry(function () { return [
    fieldNameMatcherItem,
    fieldNameByRegexMatcherItem,
    fieldTypeMatcherItem,
    fieldsByFrameRefIdItem,
    fieldNamesMatcherItem,
]; });
//# sourceMappingURL=fieldMatchersUI.js.map