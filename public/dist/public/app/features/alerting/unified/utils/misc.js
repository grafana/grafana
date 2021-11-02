import { __read } from "tslib";
import { urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ALERTMANAGER_NAME_QUERY_KEY } from './constants';
import { getRulesSourceName } from './datasource';
import * as ruleId from './rule-id';
export function createViewLink(ruleSource, rule, returnTo) {
    var sourceName = getRulesSourceName(ruleSource);
    var identifier = ruleId.fromCombinedRule(sourceName, rule);
    var paramId = encodeURIComponent(ruleId.stringifyIdentifier(identifier));
    var paramSource = encodeURIComponent(sourceName);
    return urlUtil.renderUrl(config.appSubUrl + "/alerting/" + paramSource + "/" + paramId + "/view", { returnTo: returnTo });
}
export function createExploreLink(dataSourceName, query) {
    return urlUtil.renderUrl(config.appSubUrl + "/explore", {
        left: JSON.stringify([
            'now-1h',
            'now',
            dataSourceName,
            { datasource: dataSourceName, expr: query },
            { ui: [true, true, true, 'none'] },
        ]),
    });
}
export function arrayToRecord(items) {
    return items.reduce(function (rec, _a) {
        var key = _a.key, value = _a.value;
        rec[key] = value;
        return rec;
    }, {});
}
export var getFiltersFromUrlParams = function (queryParams) {
    var queryString = queryParams['queryString'] === undefined ? undefined : String(queryParams['queryString']);
    var alertState = queryParams['alertState'] === undefined ? undefined : String(queryParams['alertState']);
    var dataSource = queryParams['dataSource'] === undefined ? undefined : String(queryParams['dataSource']);
    var ruleType = queryParams['ruleType'] === undefined ? undefined : String(queryParams['ruleType']);
    var groupBy = queryParams['groupBy'] === undefined ? undefined : String(queryParams['groupBy']).split(',');
    return { queryString: queryString, alertState: alertState, dataSource: dataSource, groupBy: groupBy, ruleType: ruleType };
};
export var getSilenceFiltersFromUrlParams = function (queryParams) {
    var queryString = queryParams['queryString'] === undefined ? undefined : String(queryParams['queryString']);
    var silenceState = queryParams['silenceState'] === undefined ? undefined : String(queryParams['silenceState']);
    return { queryString: queryString, silenceState: silenceState };
};
export function recordToArray(record) {
    return Object.entries(record).map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        return ({ key: key, value: value });
    });
}
export function makeAMLink(path, alertManagerName) {
    return "" + path + (alertManagerName ? "?" + ALERTMANAGER_NAME_QUERY_KEY + "=" + encodeURIComponent(alertManagerName) : '');
}
export function makeSilenceLink(alertmanagerSourceName, rule) {
    return (config.appSubUrl + "/alerting/silence/new?alertmanager=" + alertmanagerSourceName +
        ("&matchers=alertname=" + rule.name + "," + Object.entries(rule.labels)
            .map(function (_a) {
            var _b = __read(_a, 2), key = _b[0], value = _b[1];
            return encodeURIComponent(key + "=" + value);
        })
            .join(',')));
}
// keep retrying fn if it's error passes shouldRetry(error) and timeout has not elapsed yet
export function retryWhile(fn, shouldRetry, timeout, // milliseconds, how long to keep retrying
pause // milliseconds, pause between retries
) {
    if (pause === void 0) { pause = 1000; }
    var start = new Date().getTime();
    var makeAttempt = function () {
        return fn().catch(function (e) {
            if (shouldRetry(e) && new Date().getTime() - start < timeout) {
                return new Promise(function (resolve) { return setTimeout(resolve, pause); }).then(makeAttempt);
            }
            throw e;
        });
    };
    return makeAttempt();
}
//# sourceMappingURL=misc.js.map