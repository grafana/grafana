import { Registry } from '@grafana/data';
import { getBasicValueMatchersUI } from './BasicMatcherEditor';
import { getNoopValueMatchersUI } from './NoopMatcherEditor';
import { getRangeValueMatchersUI } from './RangeMatcherEditor';
import { getRegexValueMatchersUI } from './RegexMatcherEditor';
export const valueMatchersUI = new Registry(() => {
    return [
        ...getBasicValueMatchersUI(),
        ...getNoopValueMatchersUI(),
        ...getRangeValueMatchersUI(),
        ...getRegexValueMatchersUI(),
    ];
});
//# sourceMappingURL=valueMatchersUI.js.map