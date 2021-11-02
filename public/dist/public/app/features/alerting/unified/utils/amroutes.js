import { __assign, __read, __spreadArray } from "tslib";
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { parseInterval, timeOptions } from './time';
import { isUndefined, omitBy } from 'lodash';
import { matcherToMatcherField, parseMatcher } from './alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
var defaultValueAndType = ['', timeOptions[0].value];
var matchersToArrayFieldMatchers = function (matchers, isRegex) {
    return Object.entries(matchers !== null && matchers !== void 0 ? matchers : {}).reduce(function (acc, _a) {
        var _b = __read(_a, 2), name = _b[0], value = _b[1];
        return __spreadArray(__spreadArray([], __read(acc), false), [
            {
                name: name,
                value: value,
                operator: isRegex ? MatcherOperator.regex : MatcherOperator.equal,
            },
        ], false);
    }, []);
};
var intervalToValueAndType = function (strValue) {
    if (!strValue) {
        return defaultValueAndType;
    }
    var _a = __read(strValue ? parseInterval(strValue) : [undefined, undefined], 2), value = _a[0], valueType = _a[1];
    var timeOption = timeOptions.find(function (opt) { return opt.value === valueType; });
    if (!value || !timeOption) {
        return defaultValueAndType;
    }
    return [String(value), timeOption.value];
};
var selectableValueToString = function (selectableValue) { return selectableValue.value; };
var selectableValuesToStrings = function (arr) {
    return (arr !== null && arr !== void 0 ? arr : []).map(selectableValueToString);
};
export var emptyArrayFieldMatcher = {
    name: '',
    value: '',
    operator: MatcherOperator.equal,
};
export var emptyRoute = {
    id: '',
    groupBy: [],
    object_matchers: [],
    routes: [],
    continue: false,
    receiver: '',
    groupWaitValue: '',
    groupWaitValueType: timeOptions[0].value,
    groupIntervalValue: '',
    groupIntervalValueType: timeOptions[0].value,
    repeatIntervalValue: '',
    repeatIntervalValueType: timeOptions[0].value,
};
//returns route, and a record mapping id to existing route route
export var amRouteToFormAmRoute = function (route) {
    var _a;
    var _b, _c, _d, _e, _f, _g, _h, _j;
    if (!route || Object.keys(route).length === 0) {
        return [emptyRoute, {}];
    }
    var _k = __read(intervalToValueAndType(route.group_wait), 2), groupWaitValue = _k[0], groupWaitValueType = _k[1];
    var _l = __read(intervalToValueAndType(route.group_interval), 2), groupIntervalValue = _l[0], groupIntervalValueType = _l[1];
    var _m = __read(intervalToValueAndType(route.repeat_interval), 2), repeatIntervalValue = _m[0], repeatIntervalValueType = _m[1];
    var id = String(Math.random());
    var id2route = (_a = {},
        _a[id] = route,
        _a);
    var formRoutes = [];
    (_b = route.routes) === null || _b === void 0 ? void 0 : _b.forEach(function (subRoute) {
        var _a = __read(amRouteToFormAmRoute(subRoute), 2), subFormRoute = _a[0], subId2Route = _a[1];
        formRoutes.push(subFormRoute);
        Object.assign(id2route, subId2Route);
    });
    // Frontend migration to use object_matchers instead of matchers
    var matchers = route.matchers
        ? (_d = (_c = route.matchers) === null || _c === void 0 ? void 0 : _c.map(function (matcher) { return matcherToMatcherField(parseMatcher(matcher)); })) !== null && _d !== void 0 ? _d : []
        : (_f = (_e = route.object_matchers) === null || _e === void 0 ? void 0 : _e.map(function (matcher) { return ({ name: matcher[0], operator: matcher[1], value: matcher[2] }); })) !== null && _f !== void 0 ? _f : [];
    return [
        {
            id: id,
            object_matchers: __spreadArray(__spreadArray(__spreadArray([], __read(matchers), false), __read(matchersToArrayFieldMatchers(route.match, false)), false), __read(matchersToArrayFieldMatchers(route.match_re, true)), false),
            continue: (_g = route.continue) !== null && _g !== void 0 ? _g : false,
            receiver: (_h = route.receiver) !== null && _h !== void 0 ? _h : '',
            groupBy: (_j = route.group_by) !== null && _j !== void 0 ? _j : [],
            groupWaitValue: groupWaitValue,
            groupWaitValueType: groupWaitValueType,
            groupIntervalValue: groupIntervalValue,
            groupIntervalValueType: groupIntervalValueType,
            repeatIntervalValue: repeatIntervalValue,
            repeatIntervalValueType: repeatIntervalValueType,
            routes: formRoutes,
        },
        id2route,
    ];
};
export var formAmRouteToAmRoute = function (alertManagerSourceName, formAmRoute, id2ExistingRoute) {
    var existing = id2ExistingRoute[formAmRoute.id];
    var amRoute = __assign(__assign({}, (existing !== null && existing !== void 0 ? existing : {})), { continue: formAmRoute.continue, group_by: formAmRoute.groupBy, object_matchers: formAmRoute.object_matchers.length
            ? formAmRoute.object_matchers.map(function (matcher) { return [matcher.name, matcher.operator, matcher.value]; })
            : undefined, match: undefined, match_re: undefined, group_wait: formAmRoute.groupWaitValue
            ? "" + formAmRoute.groupWaitValue + formAmRoute.groupWaitValueType
            : undefined, group_interval: formAmRoute.groupIntervalValue
            ? "" + formAmRoute.groupIntervalValue + formAmRoute.groupIntervalValueType
            : undefined, repeat_interval: formAmRoute.repeatIntervalValue
            ? "" + formAmRoute.repeatIntervalValue + formAmRoute.repeatIntervalValueType
            : undefined, routes: formAmRoute.routes.map(function (subRoute) {
            return formAmRouteToAmRoute(alertManagerSourceName, subRoute, id2ExistingRoute);
        }) });
    if (alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME) {
        amRoute.matchers = formAmRoute.object_matchers.map(function (_a) {
            var name = _a.name, operator = _a.operator, value = _a.value;
            return "" + name + operator + value;
        });
        amRoute.object_matchers = undefined;
    }
    else {
        amRoute.matchers = undefined;
    }
    if (formAmRoute.receiver) {
        amRoute.receiver = formAmRoute.receiver;
    }
    return omitBy(amRoute, isUndefined);
};
export var stringToSelectableValue = function (str) { return ({
    label: str,
    value: str,
}); };
export var stringsToSelectableValues = function (arr) {
    return (arr !== null && arr !== void 0 ? arr : []).map(stringToSelectableValue);
};
export var mapSelectValueToString = function (selectableValue) {
    var _a;
    if (!selectableValue) {
        return '';
    }
    return (_a = selectableValueToString(selectableValue)) !== null && _a !== void 0 ? _a : '';
};
export var mapMultiSelectValueToStrings = function (selectableValues) {
    if (!selectableValues) {
        return [];
    }
    return selectableValuesToStrings(selectableValues);
};
export var optionalPositiveInteger = function (value) {
    if (!value) {
        return undefined;
    }
    return !/^\d+$/.test(value) ? 'Must be a positive integer.' : undefined;
};
//# sourceMappingURL=amroutes.js.map