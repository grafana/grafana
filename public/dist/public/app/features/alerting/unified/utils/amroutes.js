import { uniqueId } from 'lodash';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { matcherToMatcherField } from './alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { normalizeMatchers, parseMatcher } from './matchers';
import { findExistingRoute } from './routeTree';
import { isValidPrometheusDuration, safeParseDurationstr } from './time';
const matchersToArrayFieldMatchers = (matchers, isRegex) => Object.entries(matchers !== null && matchers !== void 0 ? matchers : {}).reduce((acc, [name, value]) => [
    ...acc,
    {
        name,
        value,
        operator: isRegex ? MatcherOperator.regex : MatcherOperator.equal,
    },
], []);
const selectableValueToString = (selectableValue) => selectableValue.value;
const selectableValuesToStrings = (arr) => (arr !== null && arr !== void 0 ? arr : []).map(selectableValueToString);
export const emptyArrayFieldMatcher = {
    name: '',
    value: '',
    operator: MatcherOperator.equal,
};
// Default route group_by labels for newly created routes.
export const defaultGroupBy = ['grafana_folder', 'alertname'];
// Common route group_by options for multiselect drop-down
export const commonGroupByOptions = [
    { label: 'grafana_folder', value: 'grafana_folder' },
    { label: 'alertname', value: 'alertname' },
    { label: 'Disable (...)', value: '...' },
];
export const emptyRoute = {
    id: '',
    overrideGrouping: false,
    // @PERCONA
    // @PERCONA_TODO
    groupBy: [],
    object_matchers: [],
    routes: [],
    continue: false,
    receiver: '',
    overrideTimings: false,
    groupWaitValue: '',
    groupIntervalValue: '',
    repeatIntervalValue: '',
    muteTimeIntervals: [],
};
// add unique identifiers to each route in the route tree, that way we can figure out what route we've edited / deleted
export function addUniqueIdentifierToRoute(route) {
    var _a;
    return Object.assign(Object.assign({ id: uniqueId('route-') }, route), { routes: ((_a = route.routes) !== null && _a !== void 0 ? _a : []).map(addUniqueIdentifierToRoute) });
}
//returns route, and a record mapping id to existing route
export const amRouteToFormAmRoute = (route) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (!route) {
        return emptyRoute;
    }
    const id = 'id' in route ? route.id : uniqueId('route-');
    if (Object.keys(route).length === 0) {
        const formAmRoute = Object.assign(Object.assign({}, emptyRoute), { id });
        return formAmRoute;
    }
    const formRoutes = [];
    (_a = route.routes) === null || _a === void 0 ? void 0 : _a.forEach((subRoute) => {
        const subFormRoute = amRouteToFormAmRoute(subRoute);
        formRoutes.push(subFormRoute);
    });
    const objectMatchers = (_c = (_b = route.object_matchers) === null || _b === void 0 ? void 0 : _b.map((matcher) => ({ name: matcher[0], operator: matcher[1], value: matcher[2] }))) !== null && _c !== void 0 ? _c : [];
    const matchers = (_e = (_d = route.matchers) === null || _d === void 0 ? void 0 : _d.map((matcher) => matcherToMatcherField(parseMatcher(matcher)))) !== null && _e !== void 0 ? _e : [];
    return {
        id,
        // Frontend migration to use object_matchers instead of matchers, match, and match_re
        object_matchers: [
            ...matchers,
            ...objectMatchers,
            ...matchersToArrayFieldMatchers(route.match, false),
            ...matchersToArrayFieldMatchers(route.match_re, true),
        ],
        continue: (_f = route.continue) !== null && _f !== void 0 ? _f : false,
        receiver: (_g = route.receiver) !== null && _g !== void 0 ? _g : '',
        overrideGrouping: Array.isArray(route.group_by) && route.group_by.length > 0,
        groupBy: (_h = route.group_by) !== null && _h !== void 0 ? _h : undefined,
        overrideTimings: [route.group_wait, route.group_interval, route.repeat_interval].some(Boolean),
        groupWaitValue: (_j = route.group_wait) !== null && _j !== void 0 ? _j : '',
        groupIntervalValue: (_k = route.group_interval) !== null && _k !== void 0 ? _k : '',
        repeatIntervalValue: (_l = route.repeat_interval) !== null && _l !== void 0 ? _l : '',
        routes: formRoutes,
        muteTimeIntervals: (_m = route.mute_time_intervals) !== null && _m !== void 0 ? _m : [],
    };
};
// convert a FormAmRoute to a Route
export const formAmRouteToAmRoute = (alertManagerSourceName, formAmRoute, routeTree) => {
    var _a, _b, _c, _d;
    const existing = findExistingRoute((_a = formAmRoute.id) !== null && _a !== void 0 ? _a : '', routeTree);
    const { overrideGrouping, groupBy, overrideTimings, groupWaitValue, groupIntervalValue, repeatIntervalValue, receiver, } = formAmRoute;
    // "undefined" means "inherit from the parent policy", currently supported by group_by, group_wait, group_interval, and repeat_interval
    const INHERIT_FROM_PARENT = undefined;
    const group_by = overrideGrouping ? groupBy : INHERIT_FROM_PARENT;
    const overrideGroupWait = overrideTimings && groupWaitValue;
    const group_wait = overrideGroupWait ? groupWaitValue : INHERIT_FROM_PARENT;
    const overrideGroupInterval = overrideTimings && groupIntervalValue;
    const group_interval = overrideGroupInterval ? groupIntervalValue : INHERIT_FROM_PARENT;
    const overrideRepeatInterval = overrideTimings && repeatIntervalValue;
    const repeat_interval = overrideRepeatInterval ? repeatIntervalValue : INHERIT_FROM_PARENT;
    const object_matchers = (_b = formAmRoute.object_matchers) === null || _b === void 0 ? void 0 : _b.filter((route) => route.name && route.value && route.operator).map(({ name, operator, value }) => [name, operator, value]);
    const routes = (_c = formAmRoute.routes) === null || _c === void 0 ? void 0 : _c.map((subRoute) => formAmRouteToAmRoute(alertManagerSourceName, subRoute, routeTree));
    const amRoute = Object.assign(Object.assign({}, (existing !== null && existing !== void 0 ? existing : {})), { continue: formAmRoute.continue, group_by: group_by, object_matchers: object_matchers, match: undefined, match_re: undefined, // DEPRECATED: Use matchers
        group_wait,
        group_interval,
        repeat_interval, routes: routes, mute_time_intervals: formAmRoute.muteTimeIntervals, receiver: receiver });
    // non-Grafana managed rules should use "matchers", Grafana-managed rules should use "object_matchers"
    // Grafana maintains a fork of AM to support all utf-8 characters in the "object_matchers" property values but this
    // does not exist in upstream AlertManager
    if (alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME) {
        amRoute.matchers = (_d = formAmRoute.object_matchers) === null || _d === void 0 ? void 0 : _d.map(({ name, operator, value }) => `${name}${operator}${value}`);
        amRoute.object_matchers = undefined;
    }
    else {
        amRoute.object_matchers = normalizeMatchers(amRoute);
        amRoute.matchers = undefined;
    }
    if (formAmRoute.receiver) {
        amRoute.receiver = formAmRoute.receiver;
    }
    return amRoute;
};
export const stringToSelectableValue = (str) => ({
    label: str,
    value: str,
});
export const stringsToSelectableValues = (arr) => (arr !== null && arr !== void 0 ? arr : []).map(stringToSelectableValue);
export const mapSelectValueToString = (selectableValue) => {
    var _a;
    // this allows us to deal with cleared values
    if (selectableValue === null) {
        return undefined;
    }
    if (!selectableValue) {
        return '';
    }
    return (_a = selectableValueToString(selectableValue)) !== null && _a !== void 0 ? _a : '';
};
export const mapMultiSelectValueToStrings = (selectableValues) => {
    if (!selectableValues) {
        return [];
    }
    return selectableValuesToStrings(selectableValues);
};
export function promDurationValidator(duration) {
    if (duration.length === 0) {
        return true;
    }
    return isValidPrometheusDuration(duration) || 'Invalid duration format. Must be {number}{time_unit}';
}
// function to convert ObjectMatchers to a array of strings
export const objectMatchersToString = (matchers) => {
    return matchers.map((matcher) => {
        const [name, operator, value] = matcher;
        return `${name}${operator}${value}`;
    });
};
export const repeatIntervalValidator = (repeatInterval, groupInterval) => {
    if (repeatInterval.length === 0) {
        return true;
    }
    const validRepeatInterval = promDurationValidator(repeatInterval);
    const validGroupInterval = promDurationValidator(groupInterval);
    if (validRepeatInterval !== true) {
        return validRepeatInterval;
    }
    if (validGroupInterval !== true) {
        return validGroupInterval;
    }
    const repeatDuration = safeParseDurationstr(repeatInterval);
    const groupDuration = safeParseDurationstr(groupInterval);
    const isRepeatLowerThanGroupDuration = groupDuration !== 0 && repeatDuration < groupDuration;
    return isRepeatLowerThanGroupDuration ? 'Repeat interval should be higher or equal to Group interval' : true;
};
//# sourceMappingURL=amroutes.js.map