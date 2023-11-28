import { __awaiter } from "tslib";
import React from 'react';
import { Icon, SegmentAsync } from '@grafana/ui';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
const MIN_WIDTH = 90;
export const AdHocFilterKey = ({ datasource, onChange, disabled, filterKey, allFilters }) => {
    const loadKeys = () => fetchFilterKeys(datasource, filterKey, allFilters);
    const loadKeysWithRemove = () => fetchFilterKeysWithRemove(datasource, filterKey, allFilters);
    if (filterKey === null) {
        return (React.createElement("div", { className: "gf-form", "data-testid": "AdHocFilterKey-add-key-wrapper" },
            React.createElement(SegmentAsync, { disabled: disabled, className: "query-segment-key", Component: plusSegment, value: filterKey, onChange: onChange, loadOptions: loadKeys, inputMinWidth: MIN_WIDTH })));
    }
    return (React.createElement("div", { className: "gf-form", "data-testid": "AdHocFilterKey-key-wrapper" },
        React.createElement(SegmentAsync, { disabled: disabled, className: "query-segment-key", value: filterKey, onChange: onChange, loadOptions: loadKeysWithRemove, inputMinWidth: MIN_WIDTH })));
};
export const REMOVE_FILTER_KEY = '-- remove filter --';
const REMOVE_VALUE = { label: REMOVE_FILTER_KEY, value: REMOVE_FILTER_KEY };
const plusSegment = (React.createElement("span", { className: "gf-form-label query-part", "aria-label": "Add Filter" },
    React.createElement(Icon, { name: "plus" })));
const fetchFilterKeys = (datasource, currentKey, allFilters) => __awaiter(void 0, void 0, void 0, function* () {
    const ds = yield getDatasourceSrv().get(datasource);
    if (!ds || !ds.getTagKeys) {
        return [];
    }
    const otherFilters = allFilters.filter((f) => f.key !== currentKey);
    const metrics = yield ds.getTagKeys({ filters: otherFilters });
    return metrics.map((m) => ({ label: m.text, value: m.text }));
});
const fetchFilterKeysWithRemove = (datasource, currentKey, allFilters) => __awaiter(void 0, void 0, void 0, function* () {
    const keys = yield fetchFilterKeys(datasource, currentKey, allFilters);
    return [REMOVE_VALUE, ...keys];
});
//# sourceMappingURL=AdHocFilterKey.js.map