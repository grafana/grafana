import { __assign } from "tslib";
import { useMemo } from 'react';
export var useGroupedAlerts = function (groups, groupBy) {
    return useMemo(function () {
        if (groupBy.length === 0) {
            return groups;
        }
        var alerts = groups.flatMap(function (_a) {
            var alerts = _a.alerts;
            return alerts;
        });
        return alerts.reduce(function (groupings, alert) {
            var alertContainsGroupings = groupBy.every(function (groupByLabel) { return Object.keys(alert.labels).includes(groupByLabel); });
            if (alertContainsGroupings) {
                var existingGrouping = groupings.find(function (group) {
                    return groupBy.every(function (groupKey) {
                        return group.labels[groupKey] === alert.labels[groupKey];
                    });
                });
                if (!existingGrouping) {
                    var labels = groupBy.reduce(function (acc, key) {
                        var _a;
                        acc = __assign(__assign({}, acc), (_a = {}, _a[key] = alert.labels[key], _a));
                        return acc;
                    }, {});
                    groupings.push({
                        alerts: [alert],
                        labels: labels,
                        receiver: {
                            name: 'NONE',
                        },
                    });
                }
                else {
                    existingGrouping.alerts.push(alert);
                }
            }
            else {
                var noGroupingGroup = groupings.find(function (group) { return Object.keys(group.labels).length === 0; });
                if (!noGroupingGroup) {
                    groupings.push({ alerts: [alert], labels: {}, receiver: { name: 'NONE' } });
                }
                else {
                    noGroupingGroup.alerts.push(alert);
                }
            }
            return groupings;
        }, []);
    }, [groups, groupBy]);
};
//# sourceMappingURL=useGroupedAlerts.js.map