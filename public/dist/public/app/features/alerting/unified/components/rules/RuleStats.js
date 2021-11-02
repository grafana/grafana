var _a;
import { __assign } from "tslib";
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import pluralize from 'pluralize';
import React, { Fragment, useMemo } from 'react';
import { isAlertingRule, isRecordingRule, isRecordingRulerRule } from '../../utils/rules';
import { StateColoredText } from '../StateColoredText';
var emptyStats = (_a = {
        total: 0,
        recording: 0
    },
    _a[PromAlertingRuleState.Firing] = 0,
    _a[PromAlertingRuleState.Pending] = 0,
    _a[PromAlertingRuleState.Inactive] = 0,
    _a.error = 0,
    _a);
export var RuleStats = function (_a) {
    var showInactive = _a.showInactive, showRecording = _a.showRecording, group = _a.group, namespaces = _a.namespaces;
    var calculated = useMemo(function () {
        var stats = __assign({}, emptyStats);
        var calcRule = function (rule) {
            var _a, _b;
            if (rule.promRule && isAlertingRule(rule.promRule)) {
                stats[rule.promRule.state] += 1;
            }
            if (((_a = rule.promRule) === null || _a === void 0 ? void 0 : _a.health) === 'err' || ((_b = rule.promRule) === null || _b === void 0 ? void 0 : _b.health) === 'error') {
                stats.error += 1;
            }
            if ((rule.promRule && isRecordingRule(rule.promRule)) ||
                (rule.rulerRule && isRecordingRulerRule(rule.rulerRule))) {
                stats.recording += 1;
            }
            stats.total += 1;
        };
        if (group) {
            group.rules.forEach(calcRule);
        }
        if (namespaces) {
            namespaces.forEach(function (namespace) { return namespace.groups.forEach(function (group) { return group.rules.forEach(calcRule); }); });
        }
        return stats;
    }, [group, namespaces]);
    var statsComponents = [];
    if (calculated[PromAlertingRuleState.Firing]) {
        statsComponents.push(React.createElement(StateColoredText, { key: "firing", status: PromAlertingRuleState.Firing },
            calculated[PromAlertingRuleState.Firing],
            " firing"));
    }
    if (calculated.error) {
        statsComponents.push(React.createElement(StateColoredText, { key: "errors", status: PromAlertingRuleState.Firing },
            calculated.error,
            " errors"));
    }
    if (calculated[PromAlertingRuleState.Pending]) {
        statsComponents.push(React.createElement(StateColoredText, { key: "pending", status: PromAlertingRuleState.Pending },
            calculated[PromAlertingRuleState.Pending],
            " pending"));
    }
    if (showInactive && calculated[PromAlertingRuleState.Inactive]) {
        statsComponents.push(React.createElement(StateColoredText, { key: "inactive", status: "neutral" },
            calculated[PromAlertingRuleState.Inactive],
            " normal"));
    }
    if (showRecording && calculated.recording) {
        statsComponents.push(React.createElement(StateColoredText, { key: "recording", status: "neutral" },
            calculated.recording,
            " recording"));
    }
    return (React.createElement("div", null,
        React.createElement("span", null,
            calculated.total,
            " ",
            pluralize('rule', calculated.total)),
        !!statsComponents.length && (React.createElement(React.Fragment, null,
            React.createElement("span", null, ": "),
            statsComponents.reduce(function (prev, curr, idx) {
                return prev.length
                    ? [
                        prev,
                        React.createElement(Fragment, { key: idx },
                            React.createElement("span", null, ", ")),
                        curr,
                    ]
                    : [curr];
            }, [])))));
};
//# sourceMappingURL=RuleStats.js.map