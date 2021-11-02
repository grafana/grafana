import { __read, __spreadArray } from "tslib";
import { Registry } from '@grafana/data';
import { getBasicValueMatchersUI } from './BasicMatcherEditor';
import { getNoopValueMatchersUI } from './NoopMatcherEditor';
import { getRangeValueMatchersUI } from './RangeMatcherEditor';
export var valueMatchersUI = new Registry(function () {
    return __spreadArray(__spreadArray(__spreadArray([], __read(getBasicValueMatchersUI()), false), __read(getNoopValueMatchersUI()), false), __read(getRangeValueMatchersUI()), false);
});
//# sourceMappingURL=valueMatchersUI.js.map