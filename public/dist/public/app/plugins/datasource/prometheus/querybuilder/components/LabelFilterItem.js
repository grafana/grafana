import { __awaiter } from "tslib";
import debounce from 'debounce-promise';
import React, { useState } from 'react';
import { toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AccessoryButton, InputGroup } from '@grafana/experimental';
import { AsyncSelect, Select } from '@grafana/ui';
import { truncateResult } from '../../language_utils';
export function LabelFilterItem({ item, defaultOp, onChange, onDelete, onGetLabelNames, onGetLabelValues, invalidLabel, invalidValue, getLabelValuesAutofillSuggestions, debounceDuration, }) {
    var _a, _b;
    const [state, setState] = useState({});
    // there's a bug in react-select where the menu doesn't recalculate its position when the options are loaded asynchronously
    // see https://github.com/grafana/grafana/issues/63558
    // instead, we explicitly control the menu visibility and prevent showing it until the options have fully loaded
    const [labelNamesMenuOpen, setLabelNamesMenuOpen] = useState(false);
    const [labelValuesMenuOpen, setLabelValuesMenuOpen] = useState(false);
    const isMultiSelect = (operator = item.op) => {
        var _a;
        return (_a = operators.find((op) => op.label === operator)) === null || _a === void 0 ? void 0 : _a.isMultiValue;
    };
    const getSelectOptionsFromString = (item) => {
        if (item) {
            if (item.indexOf('|') > 0) {
                return item.split('|');
            }
            return [item];
        }
        return [];
    };
    const labelValueSearch = debounce((query) => getLabelValuesAutofillSuggestions(query, item.label), debounceDuration);
    return (React.createElement("div", { "data-testid": "prometheus-dimensions-filter-item" },
        React.createElement(InputGroup, null,
            React.createElement(Select, { placeholder: "Select label", "aria-label": selectors.components.QueryBuilder.labelSelect, inputId: "prometheus-dimensions-filter-item-key", width: "auto", value: item.label ? toOption(item.label) : null, allowCustomValue: true, onOpenMenu: () => __awaiter(this, void 0, void 0, function* () {
                    setState({ isLoadingLabelNames: true });
                    const labelNames = yield onGetLabelNames(item);
                    setLabelNamesMenuOpen(true);
                    setState({ labelNames, isLoadingLabelNames: undefined });
                }), onCloseMenu: () => {
                    setLabelNamesMenuOpen(false);
                }, isOpen: labelNamesMenuOpen, isLoading: (_a = state.isLoadingLabelNames) !== null && _a !== void 0 ? _a : false, options: state.labelNames, onChange: (change) => {
                    var _a;
                    if (change.label) {
                        onChange(Object.assign(Object.assign({}, item), { op: (_a = item.op) !== null && _a !== void 0 ? _a : defaultOp, label: change.label }));
                    }
                }, invalid: invalidLabel }),
            React.createElement(Select, { "aria-label": selectors.components.QueryBuilder.matchOperatorSelect, className: "query-segment-operator", value: toOption((_b = item.op) !== null && _b !== void 0 ? _b : defaultOp), options: operators, width: "auto", onChange: (change) => {
                    if (change.value != null) {
                        onChange(Object.assign(Object.assign({}, item), { op: change.value, value: isMultiSelect(change.value) ? item.value : getSelectOptionsFromString(item === null || item === void 0 ? void 0 : item.value)[0] }));
                    }
                } }),
            React.createElement(AsyncSelect, { placeholder: "Select value", "aria-label": selectors.components.QueryBuilder.valueSelect, inputId: "prometheus-dimensions-filter-item-value", width: "auto", value: isMultiSelect()
                    ? getSelectOptionsFromString(item === null || item === void 0 ? void 0 : item.value).map(toOption)
                    : getSelectOptionsFromString(item === null || item === void 0 ? void 0 : item.value).map(toOption)[0], allowCustomValue: true, onOpenMenu: () => __awaiter(this, void 0, void 0, function* () {
                    setState({ isLoadingLabelValues: true });
                    const labelValues = yield onGetLabelValues(item);
                    truncateResult(labelValues);
                    setLabelValuesMenuOpen(true);
                    setState(Object.assign(Object.assign({}, state), { labelValues, isLoadingLabelValues: undefined }));
                }), onCloseMenu: () => {
                    setLabelValuesMenuOpen(false);
                }, isOpen: labelValuesMenuOpen, defaultOptions: state.labelValues, isMulti: isMultiSelect(), isLoading: state.isLoadingLabelValues, loadOptions: labelValueSearch, onChange: (change) => {
                    var _a, _b;
                    if (change.value) {
                        onChange(Object.assign(Object.assign({}, item), { value: change.value, op: (_a = item.op) !== null && _a !== void 0 ? _a : defaultOp }));
                    }
                    else {
                        const changes = change
                            .map((change) => {
                            return change.label;
                        })
                            .join('|');
                        // eslint-ignore
                        onChange(Object.assign(Object.assign({}, item), { value: changes, op: (_b = item.op) !== null && _b !== void 0 ? _b : defaultOp }));
                    }
                }, invalid: invalidValue }),
            React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: onDelete }))));
}
const operators = [
    { label: '=', value: '=', isMultiValue: false },
    { label: '!=', value: '!=', isMultiValue: false },
    { label: '<', value: '<', isMultiValue: false },
    { label: '>', value: '>', isMultiValue: false },
    { label: '=~', value: '=~', isMultiValue: true },
    { label: '!~', value: '!~', isMultiValue: true },
];
//# sourceMappingURL=LabelFilterItem.js.map