import { isEqual, uniqWith } from 'lodash';
import { MatcherOperator, } from 'app/plugins/datasource/alertmanager/types';
import { getAllDataSources } from './config';
import { DataSourceType } from './datasource';
export function addDefaultsToAlertmanagerConfig(config) {
    // add default receiver if it does not exist
    if (!config.alertmanager_config.receivers) {
        config.alertmanager_config.receivers = [{ name: 'default ' }];
    }
    // add default route if it does not exists
    if (!config.alertmanager_config.route) {
        config.alertmanager_config.route = {
            receiver: config.alertmanager_config.receivers[0].name,
        };
    }
    if (!config.template_files) {
        config.template_files = {};
    }
    return config;
}
export function removeMuteTimingFromRoute(muteTiming, route) {
    var _a, _b, _c;
    const newRoute = Object.assign(Object.assign({}, route), { mute_time_intervals: (_b = (_a = route.mute_time_intervals) === null || _a === void 0 ? void 0 : _a.filter((muteName) => muteName !== muteTiming)) !== null && _b !== void 0 ? _b : [], routes: (_c = route.routes) === null || _c === void 0 ? void 0 : _c.map((subRoute) => removeMuteTimingFromRoute(muteTiming, subRoute)) });
    return newRoute;
}
export function renameMuteTimings(newMuteTimingName, oldMuteTimingName, route) {
    var _a, _b;
    return Object.assign(Object.assign({}, route), { mute_time_intervals: (_a = route.mute_time_intervals) === null || _a === void 0 ? void 0 : _a.map((name) => name === oldMuteTimingName ? newMuteTimingName : name), routes: (_b = route.routes) === null || _b === void 0 ? void 0 : _b.map((subRoute) => renameMuteTimings(newMuteTimingName, oldMuteTimingName, subRoute)) });
}
function isReceiverUsedInRoute(receiver, route) {
    var _a, _b;
    return ((_b = (route.receiver === receiver || ((_a = route.routes) === null || _a === void 0 ? void 0 : _a.some((route) => isReceiverUsedInRoute(receiver, route))))) !== null && _b !== void 0 ? _b : false);
}
export function isReceiverUsed(receiver, config) {
    var _a;
    return ((_a = (config.alertmanager_config.route && isReceiverUsedInRoute(receiver, config.alertmanager_config.route))) !== null && _a !== void 0 ? _a : false);
}
export function matcherToOperator(matcher) {
    if (matcher.isEqual) {
        if (matcher.isRegex) {
            return MatcherOperator.regex;
        }
        else {
            return MatcherOperator.equal;
        }
    }
    else if (matcher.isRegex) {
        return MatcherOperator.notRegex;
    }
    else {
        return MatcherOperator.notEqual;
    }
}
export function matcherOperatorToValue(operator) {
    switch (operator) {
        case MatcherOperator.equal:
            return { isEqual: true, isRegex: false };
        case MatcherOperator.notEqual:
            return { isEqual: false, isRegex: false };
        case MatcherOperator.regex:
            return { isEqual: true, isRegex: true };
        case MatcherOperator.notRegex:
            return { isEqual: false, isRegex: true };
    }
}
export function matcherToMatcherField(matcher) {
    return {
        name: matcher.name,
        value: matcher.value,
        operator: matcherToOperator(matcher),
    };
}
export function matcherFieldToMatcher(field) {
    return Object.assign({ name: field.name, value: field.value }, matcherOperatorToValue(field.operator));
}
export function matchersToString(matchers) {
    const matcherFields = matchers.map(matcherToMatcherField);
    const combinedMatchers = matcherFields.reduce((acc, current) => {
        const currentMatcherString = `${current.name}${current.operator}"${current.value}"`;
        return acc ? `${acc},${currentMatcherString}` : currentMatcherString;
    }, '');
    return `{${combinedMatchers}}`;
}
export const matcherFieldOptions = [
    { label: MatcherOperator.equal, description: 'Equals', value: MatcherOperator.equal },
    { label: MatcherOperator.notEqual, description: 'Does not equal', value: MatcherOperator.notEqual },
    { label: MatcherOperator.regex, description: 'Matches regex', value: MatcherOperator.regex },
    { label: MatcherOperator.notRegex, description: 'Does not match regex', value: MatcherOperator.notRegex },
];
export function matcherToObjectMatcher(matcher) {
    const operator = matcherToOperator(matcher);
    return [matcher.name, operator, matcher.value];
}
export function parseMatchers(matcherQueryString) {
    const matcherRegExp = /\b([\w.-]+)(=~|!=|!~|=(?="?\w))"?([^"\n,}]*)"?/g;
    const matchers = [];
    matcherQueryString.replace(matcherRegExp, (_, key, operator, value) => {
        const isEqual = operator === MatcherOperator.equal || operator === MatcherOperator.regex;
        const isRegex = operator === MatcherOperator.regex || operator === MatcherOperator.notRegex;
        matchers.push({
            name: key,
            value: isRegex ? getValidRegexString(value.trim()) : value.trim(),
            isEqual,
            isRegex,
        });
        return '';
    });
    return matchers;
}
function getValidRegexString(regex) {
    // Regexes provided by users might be invalid, so we need to catch the error
    try {
        new RegExp(regex);
        return regex;
    }
    catch (error) {
        return '';
    }
}
export function labelsMatchMatchers(labels, matchers) {
    return matchers.every(({ name, value, isRegex, isEqual }) => {
        return Object.entries(labels).some(([labelKey, labelValue]) => {
            const nameMatches = name === labelKey;
            let valueMatches;
            if (isEqual && !isRegex) {
                valueMatches = value === labelValue;
            }
            if (!isEqual && !isRegex) {
                valueMatches = value !== labelValue;
            }
            if (isEqual && isRegex) {
                valueMatches = new RegExp(value).test(labelValue);
            }
            if (!isEqual && isRegex) {
                valueMatches = !new RegExp(value).test(labelValue);
            }
            return nameMatches && valueMatches;
        });
    });
}
export function combineMatcherStrings(...matcherStrings) {
    const matchers = matcherStrings.map(parseMatchers).flat();
    const uniqueMatchers = uniqWith(matchers, isEqual);
    return matchersToString(uniqueMatchers);
}
export function getAllAlertmanagerDataSources() {
    return getAllDataSources().filter((ds) => ds.type === DataSourceType.Alertmanager);
}
export function getAlertmanagerByUid(uid) {
    return getAllAlertmanagerDataSources().find((ds) => uid === ds.uid);
}
export function timeIntervalToString(timeInterval) {
    const { times, weekdays, days_of_month, months, years, location } = timeInterval;
    const timeString = getTimeString(times, location);
    const weekdayString = getWeekdayString(weekdays);
    const daysString = getDaysOfMonthString(days_of_month);
    const monthsString = getMonthsString(months);
    const yearsString = getYearsString(years);
    return [timeString, weekdayString, daysString, monthsString, yearsString].join(', ');
}
export function getTimeString(times, location) {
    return ('Times: ' +
        (times
            ? times === null || times === void 0 ? void 0 : times.map(({ start_time, end_time }) => `${start_time} - ${end_time} [${location !== null && location !== void 0 ? location : 'UTC'}]`).join(' and ')
            : 'All'));
}
export function getWeekdayString(weekdays) {
    var _a;
    return ('Weekdays: ' +
        ((_a = weekdays === null || weekdays === void 0 ? void 0 : weekdays.map((day) => {
            if (day.includes(':')) {
                return day
                    .split(':')
                    .map((d) => {
                    const abbreviated = d.slice(0, 3);
                    return abbreviated[0].toLocaleUpperCase() + abbreviated.slice(1);
                })
                    .join('-');
            }
            else {
                const abbreviated = day.slice(0, 3);
                return abbreviated[0].toLocaleUpperCase() + abbreviated.slice(1);
            }
        }).join(', ')) !== null && _a !== void 0 ? _a : 'All'));
}
export function getDaysOfMonthString(daysOfMonth) {
    var _a;
    return 'Days of the month: ' + ((_a = daysOfMonth === null || daysOfMonth === void 0 ? void 0 : daysOfMonth.join(', ')) !== null && _a !== void 0 ? _a : 'All');
}
export function getMonthsString(months) {
    var _a;
    return 'Months: ' + ((_a = months === null || months === void 0 ? void 0 : months.join(', ')) !== null && _a !== void 0 ? _a : 'All');
}
export function getYearsString(years) {
    var _a;
    return 'Years: ' + ((_a = years === null || years === void 0 ? void 0 : years.join(', ')) !== null && _a !== void 0 ? _a : 'All');
}
//# sourceMappingURL=alertmanager.js.map