import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { uniq } from 'lodash';
import React, { useState, useEffect, useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { AccessoryButton } from '@grafana/experimental';
import { getTemplateSrv, isFetchError } from '@grafana/runtime';
import { Select, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TraceqlSearchScope } from '../dataquery.gen';
import TempoLanguageProvider from '../language_provider';
import { operators as allOperators, stringOperators, numberOperators } from '../traceql/traceql';
import { filterScopedTag, operatorSelectableValue } from './utils';
const getStyles = () => ({
    dropdown: css `
    box-shadow: none;
  `,
});
const SearchField = ({ filter, datasource, updateFilter, deleteFilter, isTagsLoading, tags, setError, hideScope, hideTag, hideValue, allowDelete, query, }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
    const scopedTag = useMemo(() => filterScopedTag(filter), [filter]);
    // We automatically change the operator to the regex op when users select 2 or more values
    // However, they expect this to be automatically rolled back to the previous operator once
    // there's only one value selected, so we store the previous operator and value
    const [prevOperator, setPrevOperator] = useState(filter.operator);
    const [prevValue, setPrevValue] = useState(filter.value);
    const updateOptions = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            return filter.tag ? yield languageProvider.getOptionsV2(scopedTag, query) : [];
        }
        catch (error) {
            // Display message if Tempo is connected but search 404's
            if (isFetchError(error) && (error === null || error === void 0 ? void 0 : error.status) === 404) {
                setError(error);
            }
            else if (error instanceof Error) {
                dispatch(notifyApp(createErrorNotification('Error', error)));
            }
        }
        return [];
    });
    const { loading: isLoadingValues, value: options } = useAsync(updateOptions, [
        scopedTag,
        languageProvider,
        setError,
        query,
    ]);
    // Add selected option if it doesn't exist in the current list of options
    if (filter.value && !Array.isArray(filter.value) && options && !options.find((o) => o.value === filter.value)) {
        options.push({ label: filter.value.toString(), value: filter.value.toString(), type: filter.valueType });
    }
    useEffect(() => {
        if (Array.isArray(filter.value) && filter.value.length > 1 && filter.operator !== '=~') {
            setPrevOperator(filter.operator);
            updateFilter(Object.assign(Object.assign({}, filter), { operator: '=~' }));
        }
        if (Array.isArray(filter.value) && filter.value.length <= 1 && ((prevValue === null || prevValue === void 0 ? void 0 : prevValue.length) || 0) > 1) {
            updateFilter(Object.assign(Object.assign({}, filter), { operator: prevOperator, value: filter.value[0] }));
        }
    }, [prevValue, prevOperator, updateFilter, filter]);
    useEffect(() => {
        setPrevValue(filter.value);
    }, [filter.value]);
    const scopeOptions = Object.values(TraceqlSearchScope)
        .filter((s) => s !== TraceqlSearchScope.Intrinsic)
        .map((t) => ({ label: t, value: t }));
    // If all values have type string or int/float use a focused list of operators instead of all operators
    const optionsOfFirstType = options === null || options === void 0 ? void 0 : options.filter((o) => { var _a; return o.type === ((_a = options[0]) === null || _a === void 0 ? void 0 : _a.type); });
    const uniqueOptionType = (options === null || options === void 0 ? void 0 : options.length) === (optionsOfFirstType === null || optionsOfFirstType === void 0 ? void 0 : optionsOfFirstType.length) ? (_a = options === null || options === void 0 ? void 0 : options[0]) === null || _a === void 0 ? void 0 : _a.type : undefined;
    let operatorList = allOperators;
    switch (uniqueOptionType) {
        case 'string':
            operatorList = stringOperators;
            break;
        case 'int':
        case 'float':
            operatorList = numberOperators;
    }
    /**
     * Add to a list of options the current template variables.
     *
     * @param options a list of options
     * @returns the list of given options plus the template variables
     */
    const withTemplateVariableOptions = (options) => {
        const templateVariables = getTemplateSrv().getVariables();
        return [...(options || []), ...templateVariables.map((v) => ({ label: `$${v.name}`, value: `$${v.name}` }))];
    };
    return (React.createElement(HorizontalGroup, { spacing: 'none', width: 'auto' },
        !hideScope && (React.createElement(Select, { className: styles.dropdown, inputId: `${filter.id}-scope`, options: withTemplateVariableOptions(scopeOptions), value: filter.scope, onChange: (v) => {
                updateFilter(Object.assign(Object.assign({}, filter), { scope: v === null || v === void 0 ? void 0 : v.value }));
            }, placeholder: "Select scope", "aria-label": `select ${filter.id} scope` })),
        !hideTag && (React.createElement(Select, { className: styles.dropdown, inputId: `${filter.id}-tag`, isLoading: isTagsLoading, 
            // Add the current tag to the list if it doesn't exist in the tags prop, otherwise the field will be empty even though the state has a value
            options: withTemplateVariableOptions((filter.tag !== undefined ? uniq([filter.tag, ...tags]) : tags).map((t) => ({
                label: t,
                value: t,
            }))), value: filter.tag, onChange: (v) => {
                updateFilter(Object.assign(Object.assign({}, filter), { tag: v === null || v === void 0 ? void 0 : v.value }));
            }, placeholder: "Select tag", isClearable: true, "aria-label": `select ${filter.id} tag`, allowCustomValue: true })),
        React.createElement(Select, { className: styles.dropdown, inputId: `${filter.id}-operator`, options: withTemplateVariableOptions(operatorList.map(operatorSelectableValue)), value: filter.operator, onChange: (v) => {
                updateFilter(Object.assign(Object.assign({}, filter), { operator: v === null || v === void 0 ? void 0 : v.value }));
            }, isClearable: false, "aria-label": `select ${filter.id} operator`, allowCustomValue: true, width: 8 }),
        !hideValue && (React.createElement(Select, { className: styles.dropdown, inputId: `${filter.id}-value`, isLoading: isLoadingValues, options: withTemplateVariableOptions(options), value: filter.value, onChange: (val) => {
                var _a;
                if (Array.isArray(val)) {
                    updateFilter(Object.assign(Object.assign({}, filter), { value: val.map((v) => v.value), valueType: ((_a = val[0]) === null || _a === void 0 ? void 0 : _a.type) || uniqueOptionType }));
                }
                else {
                    updateFilter(Object.assign(Object.assign({}, filter), { value: val === null || val === void 0 ? void 0 : val.value, valueType: (val === null || val === void 0 ? void 0 : val.type) || uniqueOptionType }));
                }
            }, placeholder: "Select value", isClearable: false, "aria-label": `select ${filter.id} value`, allowCustomValue: true, isMulti: true, allowCreateWhileLoading: true })),
        allowDelete && (React.createElement(AccessoryButton, { variant: 'secondary', icon: 'times', onClick: () => deleteFilter === null || deleteFilter === void 0 ? void 0 : deleteFilter(filter), tooltip: 'Remove tag', "aria-label": `remove tag with ID ${filter.id}` }))));
};
export default SearchField;
//# sourceMappingURL=SearchField.js.map