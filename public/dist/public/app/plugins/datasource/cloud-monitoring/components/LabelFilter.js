import { __assign, __read, __rest, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { flatten } from 'lodash';
import { Button, HorizontalGroup, Select, VerticalGroup } from '@grafana/ui';
import { labelsToGroupedOptions, stringArrayToFilters, toOption } from '../functions';
import { SELECT_WIDTH } from '../constants';
import { QueryEditorRow } from '.';
var operators = ['=', '!=', '=~', '!=~'];
var FilterButton = React.forwardRef(function (_a, ref) {
    var value = _a.value, isOpen = _a.isOpen, invalid = _a.invalid, rest = __rest(_a, ["value", "isOpen", "invalid"]);
    return React.createElement(Button, __assign({}, rest, { ref: ref, variant: "secondary", icon: "plus" }));
});
FilterButton.displayName = 'FilterButton';
var OperatorButton = React.forwardRef(function (_a, ref) {
    var value = _a.value, rest = __rest(_a, ["value"]);
    return (React.createElement(Button, __assign({}, rest, { ref: ref, variant: "secondary" }),
        React.createElement("span", { className: "query-segment-operator" }, value === null || value === void 0 ? void 0 : value.label)));
});
OperatorButton.displayName = 'OperatorButton';
export var LabelFilter = function (_a) {
    var _b = _a.labels, labels = _b === void 0 ? {} : _b, filterArray = _a.filters, onChange = _a.onChange, variableOptionGroup = _a.variableOptionGroup;
    var filters = useMemo(function () { return stringArrayToFilters(filterArray); }, [filterArray]);
    var options = useMemo(function () { return __spreadArray([variableOptionGroup], __read(labelsToGroupedOptions(Object.keys(labels))), false); }, [
        labels,
        variableOptionGroup,
    ]);
    var filtersToStringArray = useCallback(function (filters) {
        var strArr = flatten(filters.map(function (_a) {
            var key = _a.key, operator = _a.operator, value = _a.value, condition = _a.condition;
            return [key, operator, value, condition];
        }));
        return strArr.slice(0, strArr.length - 1);
    }, []);
    var AddFilter = function () {
        return (React.createElement(Select, { menuShouldPortal: true, allowCustomValue: true, options: __spreadArray([variableOptionGroup], __read(labelsToGroupedOptions(Object.keys(labels))), false), onChange: function (_a) {
                var _b = _a.value, key = _b === void 0 ? '' : _b;
                return onChange(filtersToStringArray(__spreadArray(__spreadArray([], __read(filters), false), [{ key: key, operator: '=', condition: 'AND', value: '' }], false)));
            }, menuPlacement: "bottom", renderControl: FilterButton }));
    };
    return (React.createElement(QueryEditorRow, { label: "Filter", tooltip: 'To reduce the amount of data charted, apply a filter. A filter has three components: a label, a comparison, and a value. The comparison can be an equality, inequality, or regular expression.', noFillEnd: filters.length > 1 },
        React.createElement(VerticalGroup, { spacing: "xs", width: "auto" },
            filters.map(function (_a, index) {
                var key = _a.key, operator = _a.operator, value = _a.value, condition = _a.condition;
                // Add the current key and value as options if they are manually entered
                var keyPresent = options.some(function (op) {
                    if (op.options) {
                        return options.some(function (opp) { return opp.label === key; });
                    }
                    return op.label === key;
                });
                if (!keyPresent) {
                    options.push({ label: key, value: key });
                }
                var valueOptions = labels.hasOwnProperty(key)
                    ? __spreadArray([variableOptionGroup], __read(labels[key].map(toOption)), false) : [variableOptionGroup];
                var valuePresent = valueOptions.some(function (op) {
                    return op.label === value;
                });
                if (!valuePresent) {
                    valueOptions.push({ label: value, value: value });
                }
                return (React.createElement(HorizontalGroup, { key: index, spacing: "xs", width: "auto" },
                    React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, allowCustomValue: true, formatCreateLabel: function (v) { return "Use label key: " + v; }, value: key, options: options, onChange: function (_a) {
                            var _b = _a.value, key = _b === void 0 ? '' : _b;
                            onChange(filtersToStringArray(filters.map(function (f, i) { return (i === index ? { key: key, operator: operator, condition: condition, value: '' } : f); })));
                        } }),
                    React.createElement(Select, { menuShouldPortal: true, value: operator, options: operators.map(toOption), onChange: function (_a) {
                            var _b = _a.value, operator = _b === void 0 ? '=' : _b;
                            return onChange(filtersToStringArray(filters.map(function (f, i) { return (i === index ? __assign(__assign({}, f), { operator: operator }) : f); })));
                        }, menuPlacement: "bottom", renderControl: OperatorButton }),
                    React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, formatCreateLabel: function (v) { return "Use label value: " + v; }, allowCustomValue: true, value: value, placeholder: "add filter value", options: valueOptions, onChange: function (_a) {
                            var _b = _a.value, value = _b === void 0 ? '' : _b;
                            return onChange(filtersToStringArray(filters.map(function (f, i) { return (i === index ? __assign(__assign({}, f), { value: value }) : f); })));
                        } }),
                    React.createElement(Button, { variant: "secondary", size: "md", icon: "trash-alt", "aria-label": "Remove", onClick: function () { return onChange(filtersToStringArray(filters.filter(function (_, i) { return i !== index; }))); } }),
                    index + 1 === filters.length && Object.values(filters).every(function (_a) {
                        var value = _a.value;
                        return value;
                    }) && React.createElement(AddFilter, null)));
            }),
            !filters.length && React.createElement(AddFilter, null))));
};
//# sourceMappingURL=LabelFilter.js.map