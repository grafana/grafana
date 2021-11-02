import { __assign, __read } from "tslib";
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useMemo } from 'react';
import { labelsMatchMatchers, parseMatchers } from '../utils/alertmanager';
import { getFiltersFromUrlParams } from '../utils/misc';
export var useFilteredAmGroups = function (groups) {
    var _a = __read(useQueryParams(), 1), queryParams = _a[0];
    var filters = getFiltersFromUrlParams(queryParams);
    var matchers = parseMatchers(filters.queryString || '');
    return useMemo(function () {
        return groups.reduce(function (filteredGroup, group) {
            var alerts = group.alerts.filter(function (_a) {
                var labels = _a.labels, status = _a.status;
                var labelsMatch = labelsMatchMatchers(labels, matchers);
                var filtersMatch = filters.alertState ? status.state === filters.alertState : true;
                return labelsMatch && filtersMatch;
            });
            if (alerts.length > 0) {
                // The ungrouped alerts should be first in the results
                if (Object.keys(group.labels).length === 0) {
                    filteredGroup.unshift(__assign(__assign({}, group), { alerts: alerts }));
                }
                else {
                    filteredGroup.push(__assign(__assign({}, group), { alerts: alerts }));
                }
            }
            return filteredGroup;
        }, []);
    }, [groups, filters, matchers]);
};
//# sourceMappingURL=useFilteredAmGroups.js.map