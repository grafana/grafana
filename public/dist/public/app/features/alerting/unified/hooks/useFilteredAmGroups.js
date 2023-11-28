import { useMemo } from 'react';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { labelsMatchMatchers, parseMatchers } from '../utils/alertmanager';
import { getFiltersFromUrlParams } from '../utils/misc';
export const useFilteredAmGroups = (groups) => {
    const [queryParams] = useQueryParams();
    const filters = getFiltersFromUrlParams(queryParams);
    const matchers = parseMatchers(filters.queryString || '');
    return useMemo(() => {
        return groups.reduce((filteredGroup, group) => {
            const alerts = group.alerts.filter(({ labels, status }) => {
                const labelsMatch = labelsMatchMatchers(labels, matchers);
                const filtersMatch = filters.alertState ? status.state === filters.alertState : true;
                return labelsMatch && filtersMatch;
            });
            if (alerts.length > 0) {
                // The ungrouped alerts should be first in the results
                if (Object.keys(group.labels).length === 0) {
                    filteredGroup.unshift(Object.assign(Object.assign({}, group), { alerts }));
                }
                else {
                    filteredGroup.push(Object.assign(Object.assign({}, group), { alerts }));
                }
            }
            return filteredGroup;
        }, []);
    }, [groups, filters, matchers]);
};
//# sourceMappingURL=useFilteredAmGroups.js.map