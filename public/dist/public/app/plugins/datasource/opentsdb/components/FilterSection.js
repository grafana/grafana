import { __awaiter } from "tslib";
import debounce from 'debounce-promise';
import { size } from 'lodash';
import React, { useCallback, useState } from 'react';
import { toOption } from '@grafana/data';
import { InlineLabel, Select, InlineFormLabel, InlineSwitch, Icon, clearButtonStyles, useStyles2, AsyncSelect, } from '@grafana/ui';
export function FilterSection({ query, onChange, onRunQuery, suggestTagKeys, filterTypes, suggestTagValues, }) {
    const buttonStyles = useStyles2(clearButtonStyles);
    const [tagKeys, updTagKeys] = useState();
    const [keyIsLoading, updKeyIsLoading] = useState();
    const [addFilterMode, updAddFilterMode] = useState(false);
    const [curFilterType, updCurFilterType] = useState('iliteral_or');
    const [curFilterKey, updCurFilterKey] = useState('');
    const [curFilterValue, updCurFilterValue] = useState('');
    const [curFilterGroupBy, updCurFilterGroupBy] = useState(false);
    const [errors, setErrors] = useState('');
    const filterTypesOptions = filterTypes.map((value) => toOption(value));
    function changeAddFilterMode() {
        updAddFilterMode(!addFilterMode);
    }
    function addFilter() {
        if (query.tags && size(query.tags) > 0) {
            const err = 'Please remove tags to use filters, tags and filters are mutually exclusive.';
            setErrors(err);
            return;
        }
        if (!addFilterMode) {
            updAddFilterMode(true);
            return;
        }
        // Add the filter to the query
        const currentFilter = {
            type: curFilterType,
            tagk: curFilterKey,
            filter: curFilterValue,
            groupBy: curFilterGroupBy,
        };
        // filters may be undefined
        query.filters = query.filters ? query.filters.concat([currentFilter]) : [currentFilter];
        // reset the inputs
        updCurFilterType('literal_or');
        updCurFilterKey('');
        updCurFilterValue('');
        updCurFilterGroupBy(false);
        // fire the query
        onChange(query);
        onRunQuery();
        // close the filter ditor
        changeAddFilterMode();
    }
    function removeFilter(index) {
        var _a;
        (_a = query.filters) === null || _a === void 0 ? void 0 : _a.splice(index, 1);
        // fire the query
        onChange(query);
        onRunQuery();
    }
    function editFilter(fil, idx) {
        removeFilter(idx);
        updCurFilterKey(fil.tagk);
        updCurFilterValue(fil.filter);
        updCurFilterType(fil.type);
        updCurFilterGroupBy(fil.groupBy);
        addFilter();
    }
    // We are matching words split with space
    const splitSeparator = ' ';
    const customFilterOption = useCallback((option, searchQuery) => {
        var _a;
        const label = (_a = option.value) !== null && _a !== void 0 ? _a : '';
        const searchWords = searchQuery.split(splitSeparator);
        return searchWords.reduce((acc, cur) => acc && label.toLowerCase().includes(cur.toLowerCase()), true);
    }, []);
    const tagValueSearch = debounce((query) => suggestTagValues(query), 350);
    return (React.createElement("div", { className: "gf-form-inline", "data-testid": testIds.section },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { className: "query-keyword", width: 8, tooltip: React.createElement("div", null, "Filters does not work with tags, either of the two will work but not both.") }, "Filters"),
            query.filters &&
                query.filters.map((fil, idx) => {
                    return (React.createElement(InlineFormLabel, { key: idx, width: "auto", "data-testid": testIds.list + idx },
                        fil.tagk,
                        " = ",
                        fil.type,
                        "(",
                        fil.filter,
                        "), groupBy = ",
                        '' + fil.groupBy,
                        React.createElement("button", { type: "button", className: buttonStyles, onClick: () => editFilter(fil, idx) },
                            React.createElement(Icon, { name: 'pen' })),
                        React.createElement("button", { type: "button", className: buttonStyles, onClick: () => removeFilter(idx), "data-testid": testIds.remove },
                            React.createElement(Icon, { name: 'times' }))));
                }),
            !addFilterMode && (React.createElement("button", { className: "gf-form-label", type: "button", onClick: changeAddFilterMode, "aria-label": "Add filter" },
                React.createElement(Icon, { name: 'plus' })))),
        addFilterMode && (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(Select, { inputId: "opentsdb-suggested-tagk-select", className: "gf-form-input", value: curFilterKey ? toOption(curFilterKey) : undefined, placeholder: "key", allowCustomValue: true, filterOption: customFilterOption, onOpenMenu: () => __awaiter(this, void 0, void 0, function* () {
                        updKeyIsLoading(true);
                        const tKs = yield suggestTagKeys(query);
                        const tKsOptions = tKs.map((value) => toOption(value));
                        updTagKeys(tKsOptions);
                        updKeyIsLoading(false);
                    }), isLoading: keyIsLoading, options: tagKeys, onChange: ({ value }) => {
                        if (value) {
                            updCurFilterKey(value);
                        }
                    } })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineLabel, { className: "width-4 query-keyword" }, "Type"),
                React.createElement(Select, { inputId: "opentsdb-aggregator-select", value: curFilterType ? toOption(curFilterType) : undefined, options: filterTypesOptions, onChange: ({ value }) => {
                        if (value) {
                            updCurFilterType(value);
                        }
                    } })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(AsyncSelect, { inputId: "opentsdb-suggested-tagv-select", className: "gf-form-input", value: curFilterValue ? toOption(curFilterValue) : undefined, placeholder: "filter", allowCustomValue: true, loadOptions: tagValueSearch, defaultOptions: [], onChange: ({ value }) => {
                        if (value) {
                            updCurFilterValue(value);
                        }
                    } })),
            React.createElement(InlineFormLabel, { width: 5, className: "query-keyword" }, "Group by"),
            React.createElement(InlineSwitch, { value: curFilterGroupBy, onChange: () => {
                    // DO NOT RUN THE QUERY HERE
                    // OLD FUNCTIONALITY RAN THE QUERY
                    updCurFilterGroupBy(!curFilterGroupBy);
                } }),
            React.createElement("div", { className: "gf-form" },
                errors && (React.createElement("div", { className: "gf-form-label", title: errors, "data-testid": testIds.error },
                    React.createElement(Icon, { name: 'exclamation-triangle', color: 'rgb(229, 189, 28)' }))),
                React.createElement("div", { className: "gf-form-label" },
                    React.createElement("button", { type: "button", className: buttonStyles, onClick: addFilter }, "add filter"),
                    React.createElement("button", { type: "button", className: buttonStyles, onClick: changeAddFilterMode },
                        React.createElement(Icon, { name: 'times' })))))),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))));
}
export const testIds = {
    section: 'opentsdb-filter',
    list: 'opentsdb-filter-list',
    error: 'opentsdb-filter-error',
    remove: 'opentsdb-filter-remove',
};
//# sourceMappingURL=FilterSection.js.map