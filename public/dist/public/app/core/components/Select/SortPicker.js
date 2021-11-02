import React from 'react';
import { useAsync } from 'react-use';
import { Icon, Select } from '@grafana/ui';
import { DEFAULT_SORT } from 'app/features/search/constants';
import { SearchSrv } from '../../services/search_srv';
var searchSrv = new SearchSrv();
var getSortOptions = function (filter) {
    return searchSrv.getSortOptions().then(function (_a) {
        var sortOptions = _a.sortOptions;
        var filteredOptions = filter ? sortOptions.filter(function (o) { return filter.includes(o.name); }) : sortOptions;
        return filteredOptions.map(function (opt) { return ({ label: opt.displayName, value: opt.name }); });
    });
};
export var SortPicker = function (_a) {
    var onChange = _a.onChange, value = _a.value, placeholder = _a.placeholder, filter = _a.filter;
    // Using sync Select and manual options fetching here since we need to find the selected option by value
    var _b = useAsync(function () { return getSortOptions(filter); }, []), loading = _b.loading, options = _b.value;
    var selected = options === null || options === void 0 ? void 0 : options.find(function (opt) { return opt.value === value; });
    return !loading ? (React.createElement(Select, { menuShouldPortal: true, key: value, width: 25, onChange: onChange, value: selected !== null && selected !== void 0 ? selected : null, options: options, "aria-label": "Sort", placeholder: placeholder !== null && placeholder !== void 0 ? placeholder : "Sort (Default " + DEFAULT_SORT.label + ")", prefix: React.createElement(Icon, { name: ((value === null || value === void 0 ? void 0 : value.includes('asc')) ? 'sort-amount-up' : 'sort-amount-down') }) })) : null;
};
//# sourceMappingURL=SortPicker.js.map