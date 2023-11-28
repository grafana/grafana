import { getValuesFromQueryParams } from 'app/percona/shared/helpers/getValuesFromQueryParams';
import { FilterFieldTypes } from '..';
import { ALL_LABEL, ALL_VALUE, SEARCH_INPUT_FIELD_NAME, SEARCH_SELECT_FIELD_NAME } from './Filter.constants';
export const getQueryParams = (columns, queryParams) => {
    const customTransform = (params) => {
        if (params !== undefined && params !== null) {
            return params.toString();
        }
        return undefined;
    };
    const queryKeys = columns.map((column) => ({ key: column.accessor, transform: customTransform }));
    queryKeys.push({ key: SEARCH_INPUT_FIELD_NAME, transform: customTransform });
    queryKeys.push({ key: SEARCH_SELECT_FIELD_NAME, transform: customTransform });
    const params = getValuesFromQueryParams(queryParams, queryKeys);
    return params !== null && params !== void 0 ? params : {};
};
export const buildObjForQueryParams = (columns, values) => {
    var _a, _b;
    let obj = {
        [SEARCH_INPUT_FIELD_NAME]: values[SEARCH_INPUT_FIELD_NAME],
        [SEARCH_SELECT_FIELD_NAME]: (_b = (_a = values[SEARCH_SELECT_FIELD_NAME]) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : values[SEARCH_SELECT_FIELD_NAME],
    };
    const searchSelectValue = obj[SEARCH_SELECT_FIELD_NAME];
    const searchInputValue = obj[SEARCH_INPUT_FIELD_NAME];
    if (searchInputValue) {
        obj[SEARCH_SELECT_FIELD_NAME] = searchSelectValue !== null && searchSelectValue !== void 0 ? searchSelectValue : ALL_VALUE;
    }
    else if (searchSelectValue) {
        obj[SEARCH_SELECT_FIELD_NAME] = undefined;
    }
    columns.forEach((column) => {
        var _a, _b;
        const accessor = column.accessor;
        const value = (_b = (_a = values[accessor]) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : values[accessor];
        if (value) {
            if (column.type === FilterFieldTypes.RADIO_BUTTON || column.type === FilterFieldTypes.DROPDOWN) {
                obj[accessor] = value === ALL_VALUE ? undefined : value.toString();
            }
        }
    });
    return obj;
};
export const buildParamsFromKey = (tableKey, columns, values) => {
    const params = buildObjForQueryParams(columns, values);
    if (tableKey) {
        const paramsResult = Object.values(params).some((value) => value !== undefined);
        if (paramsResult) {
            return { [tableKey]: JSON.stringify(params) };
        }
        return { [tableKey]: undefined };
    }
    return params;
};
export const buildSearchOptions = (columns) => {
    const searchOptions = columns
        .filter((value) => value.type === FilterFieldTypes.TEXT)
        .map((column) => {
        var _a, _b;
        return ({
            value: (_a = column.accessor) === null || _a === void 0 ? void 0 : _a.toString(),
            label: (_b = column.Header) === null || _b === void 0 ? void 0 : _b.toString(),
        });
    });
    searchOptions.unshift({ value: ALL_VALUE, label: ALL_LABEL });
    return searchOptions;
};
export const buildEmptyValues = (columns) => {
    let obj = {
        [SEARCH_INPUT_FIELD_NAME]: undefined,
        [SEARCH_SELECT_FIELD_NAME]: ALL_VALUE,
    };
    columns.map((column) => {
        if (column.type === FilterFieldTypes.DROPDOWN || column.type === FilterFieldTypes.RADIO_BUTTON) {
            obj = Object.assign(Object.assign({}, obj), { [column.accessor]: ALL_VALUE });
        }
    });
    return obj;
};
export const isValueInTextColumn = (columns, filterValue, queryParamsObj) => {
    const searchInputValue = queryParamsObj[SEARCH_INPUT_FIELD_NAME];
    const selectColumnValue = queryParamsObj[SEARCH_SELECT_FIELD_NAME];
    let result = false;
    columns.forEach((column) => {
        if (column.type === FilterFieldTypes.TEXT) {
            if (searchInputValue) {
                if ((column.accessor === selectColumnValue || selectColumnValue === ALL_VALUE) &&
                    isTextIncluded(searchInputValue, filterValue[column.accessor])) {
                    result = true;
                }
            }
            else {
                result = true;
            }
        }
    });
    return result;
};
export const isTextIncluded = (needle, haystack) => haystack.toString().toLowerCase().includes(needle.toLowerCase());
export const isInOptions = (columns, filterValue, queryParamsObj, filterFieldType) => {
    let result = [];
    columns.forEach((column) => {
        const accessor = column.accessor;
        const queryParamValueAccessor = queryParamsObj[accessor];
        const filterValueAccessor = filterValue[accessor];
        if (column.type === filterFieldType) {
            if (queryParamValueAccessor) {
                if (queryParamValueAccessor.toLowerCase() === (filterValueAccessor === null || filterValueAccessor === void 0 ? void 0 : filterValueAccessor.toString().toLowerCase())) {
                    result.push(true);
                }
                else {
                    result.push(false);
                }
            }
            else {
                result.push(true);
            }
        }
    });
    return result.every((value) => value);
};
export const isOtherThanTextType = (columns) => {
    return columns.find((column) => {
        return column.type !== undefined && column.type !== FilterFieldTypes.TEXT;
    })
        ? true
        : false;
};
export const buildColumnOptions = (column) => {
    var _a, _b;
    column.options = (_a = column.options) === null || _a === void 0 ? void 0 : _a.map((option) => { var _a; return (Object.assign(Object.assign({}, option), { value: (_a = option.value) === null || _a === void 0 ? void 0 : _a.toString() })); });
    return [{ value: ALL_VALUE, label: ALL_LABEL }, ...((_b = column.options) !== null && _b !== void 0 ? _b : [])];
};
//# sourceMappingURL=Filter.utils.js.map