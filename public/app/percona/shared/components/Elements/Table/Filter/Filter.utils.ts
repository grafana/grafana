import { UrlQueryMap, UrlQueryValue } from '@grafana/data';
import { getValuesFromQueryParams } from 'app/percona/shared/helpers/getValuesFromQueryParams';

import { ExtendedColumn, FilterFieldTypes } from '..';

import { ALL_LABEL, ALL_VALUE, SEARCH_INPUT_FIELD_NAME, SEARCH_SELECT_FIELD_NAME } from './Filter.constants';
import { FilterFormValues } from './Filter.types';

export const getQueryParams = <T extends object>(columns: Array<ExtendedColumn<T>>, queryParams: UrlQueryMap) => {
  const customTransform = (params: UrlQueryValue): string | undefined => {
    if (params !== undefined && params !== null) {
      return params.toString();
    }
    return undefined;
  };
  const queryKeys = columns.map((column) => ({ key: column.accessor as string, transform: customTransform }));
  queryKeys.push({ key: SEARCH_INPUT_FIELD_NAME, transform: customTransform });
  queryKeys.push({ key: SEARCH_SELECT_FIELD_NAME, transform: customTransform });
  const params = getValuesFromQueryParams(queryParams, queryKeys);
  return params ?? {};
};

export const buildObjForQueryParams = <T extends object>(
  columns: Array<ExtendedColumn<T>>,
  values: FilterFormValues
) => {
  let obj: FilterFormValues = {
    [SEARCH_INPUT_FIELD_NAME]: values[SEARCH_INPUT_FIELD_NAME],
    [SEARCH_SELECT_FIELD_NAME]: values[SEARCH_SELECT_FIELD_NAME]?.value ?? values[SEARCH_SELECT_FIELD_NAME],
  };
  const searchSelectValue = obj[SEARCH_SELECT_FIELD_NAME];
  const searchInputValue = obj[SEARCH_INPUT_FIELD_NAME];

  if (searchInputValue) {
    obj[SEARCH_SELECT_FIELD_NAME] = searchSelectValue ?? ALL_VALUE;
  } else if (searchSelectValue) {
    obj[SEARCH_SELECT_FIELD_NAME] = undefined;
  }

  columns.forEach((column) => {
    const accessor = column.accessor as string;
    const value = values[accessor]?.value ?? values[accessor];

    if (value) {
      if (column.type === FilterFieldTypes.RADIO_BUTTON || column.type === FilterFieldTypes.DROPDOWN) {
        obj[accessor] = value === ALL_VALUE ? undefined : value.toString();
      }
    }
  });

  return obj;
};

export const buildParamsFromKey = <T extends object>(
  tableKey: string | undefined,
  columns: Array<ExtendedColumn<T>>,
  values: FilterFormValues
) => {
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

export const buildSearchOptions = <T extends object>(columns: Array<ExtendedColumn<T>>) => {
  const searchOptions = columns
    .filter((value) => value.type === FilterFieldTypes.TEXT)
    .map((column) => ({
      value: column.accessor?.toString(),
      label: column.Header?.toString(),
    }));
  searchOptions.unshift({ value: ALL_VALUE, label: ALL_LABEL });
  return searchOptions;
};

export const buildEmptyValues = <T extends object>(columns: Array<ExtendedColumn<T>>) => {
  let obj = {
    [SEARCH_INPUT_FIELD_NAME]: undefined,
    [SEARCH_SELECT_FIELD_NAME]: ALL_VALUE,
  };
  columns.map((column) => {
    if (column.type === FilterFieldTypes.DROPDOWN || column.type === FilterFieldTypes.RADIO_BUTTON) {
      obj = { ...obj, [column.accessor as string]: ALL_VALUE };
    }
  });
  return obj;
};

export const isValueInTextColumn = <T extends object>(
  columns: Array<ExtendedColumn<T>>,
  filterValue: T,
  queryParamsObj: Record<string, string>
) => {
  const searchInputValue = queryParamsObj[SEARCH_INPUT_FIELD_NAME];
  const selectColumnValue = queryParamsObj[SEARCH_SELECT_FIELD_NAME];
  let result = false;
  columns.forEach((column) => {
    if (column.type === FilterFieldTypes.TEXT) {
      if (searchInputValue) {
        if (
          (column.accessor === selectColumnValue || selectColumnValue === ALL_VALUE) &&
          isTextIncluded(searchInputValue, filterValue[column.accessor as keyof T] as string | number)
        ) {
          result = true;
        }
      } else {
        result = true;
      }
    }
  });
  return result;
};

export const isTextIncluded = (needle: string, haystack: string | number): boolean =>
  haystack?.toString().toLowerCase().includes(needle.toLowerCase());

export const isInOptions = <T extends object>(
  columns: Array<ExtendedColumn<T>>,
  filterValue: T,
  queryParamsObj: Record<string, string>,
  filterFieldType: FilterFieldTypes
) => {
  let result: boolean[] = [];

  columns.forEach((column) => {
    const accessor = column.accessor;
    const queryParamValueAccessor = queryParamsObj[accessor as string];
    const filterValueAccessor = filterValue[accessor as keyof T];
    if (column.type === filterFieldType) {
      if (queryParamValueAccessor) {
        if (queryParamValueAccessor.toLowerCase() === filterValueAccessor?.toString().toLowerCase()) {
          result.push(true);
        } else {
          result.push(false);
        }
      } else {
        result.push(true);
      }
    }
  });
  return result.every((value) => value);
};

export const isOtherThanTextType = <T extends object>(columns: Array<ExtendedColumn<T>>): boolean =>
  columns.some((column) => column.type !== undefined && column.type !== FilterFieldTypes.TEXT);

export const buildColumnOptions = <T extends object>(column: ExtendedColumn<T>) => {
  column.options = column.options?.map((option) => ({ ...option, value: option.value?.toString() }));
  return [{ value: ALL_VALUE, label: ALL_LABEL }, ...(column.options ?? [])];
};

export const getFilteredData = <T extends object>(
  rawData: T[],
  columns: Array<ExtendedColumn<T>>,
  queryParamsObj: Record<string, string>
) =>
  rawData.filter(
    (filterValue) =>
      isValueInTextColumn(columns, filterValue, queryParamsObj) &&
      isInOptions(columns, filterValue, queryParamsObj, FilterFieldTypes.DROPDOWN) &&
      isInOptions(columns, filterValue, queryParamsObj, FilterFieldTypes.RADIO_BUTTON)
  );
