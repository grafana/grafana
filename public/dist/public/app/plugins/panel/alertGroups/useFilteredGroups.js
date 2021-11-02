import { labelsMatchMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { useMemo } from 'react';
export var useFilteredGroups = function (groups, matchers) {
    return useMemo(function () {
        return groups.filter(function (group) {
            return (labelsMatchMatchers(group.labels, matchers) ||
                group.alerts.some(function (alert) { return labelsMatchMatchers(alert.labels, matchers); }));
        });
    }, [groups, matchers]);
};
//# sourceMappingURL=useFilteredGroups.js.map