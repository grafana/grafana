import { useMemo } from 'react';
import { labelsMatchMatchers } from 'app/features/alerting/unified/utils/alertmanager';
export const useFilteredGroups = (groups, matchers) => {
    return useMemo(() => {
        return groups.filter((group) => {
            return (labelsMatchMatchers(group.labels, matchers) ||
                group.alerts.some((alert) => labelsMatchMatchers(alert.labels, matchers)));
        });
    }, [groups, matchers]);
};
//# sourceMappingURL=useFilteredGroups.js.map