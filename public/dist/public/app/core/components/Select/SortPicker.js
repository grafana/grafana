import { __awaiter } from "tslib";
import React from 'react';
import { useAsync } from 'react-use';
import { Icon, Select } from '@grafana/ui';
import { DEFAULT_SORT } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service';
const defaultSortOptionsGetter = () => {
    return getGrafanaSearcher().getSortOptions();
};
export function SortPicker({ onChange, value, placeholder, filter, getSortOptions, isClearable }) {
    var _a, _b;
    // Using sync Select and manual options fetching here since we need to find the selected option by value
    const options = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        const vals = yield (getSortOptions !== null && getSortOptions !== void 0 ? getSortOptions : defaultSortOptionsGetter)();
        if (filter) {
            return vals.filter((v) => filter.includes(v.value));
        }
        return vals;
    }), [getSortOptions, filter]);
    if (options.loading) {
        return null;
    }
    const isDesc = Boolean((value === null || value === void 0 ? void 0 : value.includes('desc')) || (value === null || value === void 0 ? void 0 : value.startsWith('-'))); // bluge syntax starts with "-"
    return (React.createElement(Select, { key: value, width: 28, onChange: onChange, value: (_b = (_a = options.value) === null || _a === void 0 ? void 0 : _a.find((opt) => opt.value === value)) !== null && _b !== void 0 ? _b : null, options: options.value, "aria-label": "Sort", placeholder: placeholder !== null && placeholder !== void 0 ? placeholder : `Sort (Default ${DEFAULT_SORT.label})`, prefix: React.createElement(Icon, { name: isDesc ? 'sort-amount-down' : 'sort-amount-up' }), isClearable: isClearable }));
}
//# sourceMappingURL=SortPicker.js.map