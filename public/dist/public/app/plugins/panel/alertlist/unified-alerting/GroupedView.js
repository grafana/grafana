import React, { useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { AlertLabel } from 'app/features/alerting/unified/components/AlertLabel';
import { getAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
import { filterAlerts } from '../util';
export const UNGROUPED_KEY = '__ungrouped__';
const GroupedModeView = ({ rules, options }) => {
    const styles = useStyles2(getStyles);
    const groupBy = options.groupBy;
    const groupedRules = useMemo(() => {
        var _a;
        const groupedRules = new Map();
        const hasInstancesWithMatchingLabels = (rule) => groupBy ? alertHasEveryLabelForCombinedRules(rule, groupBy) : true;
        rules.forEach((rule) => {
            var _a;
            const alertingRule = getAlertingRule(rule);
            const hasInstancesMatching = hasInstancesWithMatchingLabels(rule);
            ((_a = alertingRule === null || alertingRule === void 0 ? void 0 : alertingRule.alerts) !== null && _a !== void 0 ? _a : []).forEach((alert) => {
                var _a;
                const mapKey = hasInstancesMatching ? createMapKey(groupBy, alert.labels) : UNGROUPED_KEY;
                const existingAlerts = (_a = groupedRules.get(mapKey)) !== null && _a !== void 0 ? _a : [];
                groupedRules.set(mapKey, [...existingAlerts, alert]);
            });
        });
        // move the "UNGROUPED" key to the last item in the Map, items are shown in insertion order
        const ungrouped = (_a = groupedRules.get(UNGROUPED_KEY)) !== null && _a !== void 0 ? _a : [];
        groupedRules.delete(UNGROUPED_KEY);
        groupedRules.set(UNGROUPED_KEY, ungrouped);
        // Remove groups having no instances
        // This is different from filtering Rules without instances that we do in UnifiedAlertList
        const filteredGroupedRules = Array.from(groupedRules.entries()).reduce((acc, [groupKey, groupAlerts]) => {
            const filteredAlerts = filterAlerts(options, groupAlerts);
            if (filteredAlerts.length > 0) {
                acc.set(groupKey, filteredAlerts);
            }
            return acc;
        }, new Map());
        return filteredGroupedRules;
    }, [groupBy, rules, options]);
    return (React.createElement(React.Fragment, null, Array.from(groupedRules).map(([key, alerts]) => (React.createElement("li", { className: styles.alertRuleItem, key: key, "data-testid": key },
        React.createElement("div", null,
            React.createElement("div", { className: styles.customGroupDetails },
                React.createElement("div", { className: styles.alertLabels },
                    key !== UNGROUPED_KEY &&
                        parseMapKey(key).map(([key, value]) => React.createElement(AlertLabel, { key: key, labelKey: key, value: value })),
                    key === UNGROUPED_KEY && 'No grouping')),
            React.createElement(AlertInstances, { alerts: alerts, options: options })))))));
};
function createMapKey(groupBy, labels) {
    return new URLSearchParams(groupBy.map((key) => [key, labels[key]])).toString();
}
function parseMapKey(key) {
    return [...new URLSearchParams(key)];
}
function alertHasEveryLabelForCombinedRules(rule, groupByKeys) {
    const alertingRule = getAlertingRule(rule);
    return groupByKeys.every((key) => {
        var _a;
        return ((_a = alertingRule === null || alertingRule === void 0 ? void 0 : alertingRule.alerts) !== null && _a !== void 0 ? _a : []).some((alert) => alert.labels[key]);
    });
}
export default GroupedModeView;
//# sourceMappingURL=GroupedView.js.map