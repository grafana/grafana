import { __assign, __read } from "tslib";
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
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
function isReceiverUsedInRoute(receiver, route) {
    var _a, _b;
    return ((_b = (route.receiver === receiver || ((_a = route.routes) === null || _a === void 0 ? void 0 : _a.some(function (route) { return isReceiverUsedInRoute(receiver, route); })))) !== null && _b !== void 0 ? _b : false);
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
    return __assign({ name: field.name, value: field.value }, matcherOperatorToValue(field.operator));
}
export var matcherFieldOptions = [
    { label: MatcherOperator.equal, description: 'Equals', value: MatcherOperator.equal },
    { label: MatcherOperator.notEqual, description: 'Does not equal', value: MatcherOperator.notEqual },
    { label: MatcherOperator.regex, description: 'Matches regex', value: MatcherOperator.regex },
    { label: MatcherOperator.notRegex, description: 'Does not match regex', value: MatcherOperator.notRegex },
];
var matcherOperators = [
    MatcherOperator.regex,
    MatcherOperator.notRegex,
    MatcherOperator.notEqual,
    MatcherOperator.equal,
];
function unescapeMatcherValue(value) {
    var trimmed = value.trim().replace(/\\"/g, '"');
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.endsWith('\\"')) {
        trimmed = trimmed.substr(1, trimmed.length - 2);
    }
    return trimmed.replace(/\\"/g, '"');
}
function escapeMatcherValue(value) {
    return '"' + value.replace(/"/g, '\\"') + '"';
}
export function stringifyMatcher(matcher) {
    return "" + matcher.name + matcherToOperator(matcher) + escapeMatcherValue(matcher.value);
}
export function parseMatcher(matcher) {
    var trimmed = matcher.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        throw new Error("PromQL matchers not supported yet, sorry! PromQL matcher found: " + trimmed);
    }
    var operatorsFound = matcherOperators
        .map(function (op) { return [op, trimmed.indexOf(op)]; })
        .filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], idx = _b[1];
        return idx > -1;
    })
        .sort(function (a, b) { return a[1] - b[1]; });
    if (!operatorsFound.length) {
        throw new Error("Invalid matcher: " + trimmed);
    }
    var _a = __read(operatorsFound[0], 2), operator = _a[0], idx = _a[1];
    var name = trimmed.substr(0, idx).trim();
    var value = unescapeMatcherValue(trimmed.substr(idx + operator.length).trim());
    if (!name) {
        throw new Error("Invalid matcher: " + trimmed);
    }
    return {
        name: name,
        value: value,
        isRegex: operator === MatcherOperator.regex || operator === MatcherOperator.notRegex,
        isEqual: operator === MatcherOperator.equal || operator === MatcherOperator.regex,
    };
}
export function parseMatchers(matcherQueryString) {
    var matcherRegExp = /\b(\w+)(=~|!=|!~|=(?="?\w))"?([^"\n,]*)"?/g;
    var matchers = [];
    matcherQueryString.replace(matcherRegExp, function (_, key, operator, value) {
        var isEqual = operator === MatcherOperator.equal || operator === MatcherOperator.regex;
        var isRegex = operator === MatcherOperator.regex || operator === MatcherOperator.notRegex;
        matchers.push({
            name: key,
            value: value,
            isEqual: isEqual,
            isRegex: isRegex,
        });
        return '';
    });
    return matchers;
}
export function labelsMatchMatchers(labels, matchers) {
    return matchers.every(function (_a) {
        var name = _a.name, value = _a.value, isRegex = _a.isRegex, isEqual = _a.isEqual;
        return Object.entries(labels).some(function (_a) {
            var _b = __read(_a, 2), labelKey = _b[0], labelValue = _b[1];
            var nameMatches = name === labelKey;
            var valueMatches;
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
export function getAllAlertmanagerDataSources() {
    return getAllDataSources().filter(function (ds) { return ds.type === DataSourceType.Alertmanager; });
}
export function getAlertmanagerByUid(uid) {
    return getAllAlertmanagerDataSources().find(function (ds) { return uid === ds.uid; });
}
//# sourceMappingURL=alertmanager.js.map