import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { CoreApp, getDefaultTimeRange } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { HorizontalGroup, Select, ButtonSelect, AsyncMultiSelect, getSelectStyles, useTheme2, Checkbox, } from '@grafana/ui';
import { AzureQueryType } from '../../dataquery.gen';
import { addValueToOptions } from '../../utils/common';
const onFieldChange = (fieldName, item, selected, onChange) => {
    if (fieldName === 'filters') {
        item[fieldName] = selected.map((item) => item.value);
    }
    else {
        item[fieldName] = selected.value;
        if (fieldName === 'property') {
            item.filters = [];
        }
    }
    onChange(item);
};
const getTraceProperties = (query, datasource, traceTypes, propertyMap, setPropertyMap, filter, range) => __awaiter(void 0, void 0, void 0, function* () {
    const { azureTraces } = query;
    if (!azureTraces) {
        return [];
    }
    const { resources } = azureTraces;
    if (!resources || !filter) {
        return [];
    }
    const property = filter.property;
    if (!property) {
        return [];
    }
    const queryString = `let ${property} = toscalar(union isfuzzy=true ${traceTypes.join(',')}
  | where $__timeFilter(timestamp)
  | summarize count=count() by ${property}
  | summarize make_list(pack_all()));
  print properties = bag_pack("${property}", ${property});`;
    const results = yield lastValueFrom(datasource.azureLogAnalyticsDatasource.query({
        requestId: 'azure-traces-properties-req',
        interval: '',
        intervalMs: 0,
        scopedVars: {},
        timezone: '',
        startTime: 0,
        app: CoreApp.Unknown,
        targets: [
            Object.assign(Object.assign({}, query), { azureLogAnalytics: {
                    resources,
                    query: queryString,
                }, queryType: AzureQueryType.LogAnalytics }),
        ],
        range: range || getDefaultTimeRange(),
    }));
    if (results.data.length > 0) {
        const result = results.data[0];
        if (result.fields.length > 0) {
            const properties = JSON.parse(result.fields[0].values.toArray()[0]);
            const values = properties[property].map((value) => {
                let label = value[property];
                if (value[property] === '') {
                    label = '<Empty>';
                }
                return { label: label.toString(), value: value[property].toString(), count: value.count };
            });
            propertyMap.set(property, values);
            setPropertyMap(propertyMap);
            return values;
        }
    }
    return [];
});
export function makeRenderItem(props) {
    function renderItem(item, onChange, onDelete) {
        return React.createElement(Filter, Object.assign({}, props, { item: item, onChange: onChange, onDelete: onDelete }));
    }
    return renderItem;
}
const Option = (props) => {
    const { data, innerProps, innerRef, isFocused, isSelected } = props;
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const onClickMultiOption = (e) => {
        props.selectOption(Object.assign({}, data));
        e.stopPropagation();
        e.preventDefault();
    };
    return (React.createElement("div", Object.assign({ ref: innerRef, className: cx(styles.option, isFocused && styles.optionFocused, isSelected && styles.optionSelected, data.isDisabled && styles.optionDisabled) }, innerProps, { "aria-label": "Select option", title: data.title, onClick: onClickMultiOption, onKeyDown: onClickMultiOption, role: "checkbox", "aria-checked": isSelected, tabIndex: 0 }),
        React.createElement("div", { className: styles.optionBody },
            React.createElement(Checkbox, { value: isSelected, label: data.label ? `${data.label} - (${data.count})` : '' }))));
};
const Filter = (props) => {
    var _a, _b;
    const { query, datasource, propertyMap, setPropertyMap, queryTraceTypes, properties, item, onChange, onDelete, variableOptionGroup, range, } = props;
    const [loading, setLoading] = useState(false);
    const [values, setValues] = useState(addValueToOptions((_b = propertyMap.get((_a = item.property) !== null && _a !== void 0 ? _a : '')) !== null && _b !== void 0 ? _b : [], variableOptionGroup));
    const [selected, setSelected] = useState(item.filters ? item.filters.map((filter) => ({ value: filter, label: filter === '' ? '<Empty>' : filter })) : []);
    const loadOptions = () => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        setLoading(true);
        if (item.property && item.property !== '') {
            const vals = propertyMap.get((_c = item.property) !== null && _c !== void 0 ? _c : '');
            if (!vals) {
                const promise = yield getTraceProperties(query, datasource, queryTraceTypes, propertyMap, setPropertyMap, item, range);
                setValues(addValueToOptions(promise, variableOptionGroup));
                setLoading(false);
                return promise;
            }
            else {
                setValues(addValueToOptions(vals, variableOptionGroup));
                setLoading(false);
                return Promise.resolve(vals);
            }
        }
        const empty = [];
        return Promise.resolve(empty);
    });
    return (React.createElement(HorizontalGroup, { spacing: "none" },
        React.createElement(Select, { menuShouldPortal: true, placeholder: "Property", value: item.property ? { value: item.property, label: item.property } : null, options: addValueToOptions(properties.map((type) => ({ label: type, value: type })), variableOptionGroup), onChange: (e) => onFieldChange('property', item, e, onChange), width: 25 }),
        React.createElement(ButtonSelect, { placeholder: "Operator", value: item.operation ? { label: item.operation === 'eq' ? '=' : '!=', value: item.operation } : undefined, options: [
                { label: '=', value: 'eq' },
                { label: '!=', value: 'ne' },
            ], onChange: (e) => onFieldChange('operation', item, e, onChange), defaultValue: 'eq' }),
        React.createElement(AsyncMultiSelect, { blurInputOnSelect: false, menuShouldPortal: true, placeholder: "Value", value: selected, loadOptions: loadOptions, isLoading: loading, onOpenMenu: loadOptions, onChange: (e) => {
                setSelected(e);
                if (e.length === 0) {
                    onFieldChange('filters', item, selected, onChange);
                }
            }, width: 35, defaultOptions: values, isClearable: true, components: { Option }, closeMenuOnSelect: false, onCloseMenu: () => onFieldChange('filters', item, selected, onChange), hideSelectedOptions: false }),
        React.createElement(AccessoryButton, { "aria-label": "Remove filter", icon: "times", variant: "secondary", onClick: onDelete, type: "button" })));
};
export default Filter;
//# sourceMappingURL=Filter.js.map