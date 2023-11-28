import { __awaiter } from "tslib";
import React from 'react';
import { SegmentAsync } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
export const AdHocFilterValue = ({ datasource, disabled, onChange, filterKey, filterValue, placeHolder, allFilters, }) => {
    const loadValues = () => fetchFilterValues(datasource, filterKey, allFilters);
    return (React.createElement("div", { className: "gf-form", "data-testid": "AdHocFilterValue-value-wrapper" },
        React.createElement(SegmentAsync, { className: "query-segment-value", disabled: disabled, placeholder: placeHolder, value: filterValue, onChange: onChange, loadOptions: loadValues })));
};
const fetchFilterValues = (datasource, key, allFilters) => __awaiter(void 0, void 0, void 0, function* () {
    const ds = yield getDatasourceSrv().get(datasource);
    if (!ds || !ds.getTagValues) {
        return [];
    }
    const timeRange = getTimeSrv().timeRange();
    // Filter out the current filter key from the list of all filters
    const otherFilters = allFilters.filter((f) => f.key !== key);
    const metrics = yield ds.getTagValues({ key, filters: otherFilters, timeRange });
    return metrics.map((m) => ({ label: m.text, value: m.text }));
});
//# sourceMappingURL=AdHocFilterValue.js.map