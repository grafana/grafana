import { __read } from "tslib";
import { parseMatcher } from './alertmanager';
// parses comma separated matchers like "foo=bar,baz=~bad*" into SilenceMatcher[]
export function parseQueryParamMatchers(paramValue) {
    return paramValue
        .split(',')
        .filter(function (x) { return !!x.trim(); })
        .map(function (x) { return parseMatcher(x.trim()); });
}
export var getMatcherQueryParams = function (labels) {
    return "matchers=" + encodeURIComponent(Object.entries(labels)
        .filter(function (_a) {
        var _b = __read(_a, 1), labelKey = _b[0];
        return !(labelKey.startsWith('__') && labelKey.endsWith('__'));
    })
        .map(function (_a) {
        var _b = __read(_a, 2), labelKey = _b[0], labelValue = _b[1];
        return labelKey + "=" + labelValue;
    })
        .join(','));
};
//# sourceMappingURL=matchers.js.map