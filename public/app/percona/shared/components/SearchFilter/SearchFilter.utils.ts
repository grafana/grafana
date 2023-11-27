import { useCallback, useMemo } from 'react';

import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { ExtendedColumn, FilterFieldTypes } from '../Elements/Table';
import { buildParamsFromKey } from '../Elements/Table/Filter/Filter.utils';

import { QueryParamsValues } from './SearchFilter.types';

export const getFilterColumns = <T extends object>(columns: Array<ExtendedColumn<T>>): Array<ExtendedColumn<T>> =>
  columns.filter((col) => col.type === FilterFieldTypes.DROPDOWN || col.type === FilterFieldTypes.RADIO_BUTTON);

export const useQueryParamsByKey = (tableKey?: string) => {
  const [queryParams, setQueryParams] = useQueryParams();
  const queryParamsByKey = useMemo(() => {
    if (tableKey) {
      const params = queryParams[tableKey];

      if (params) {
        // @ts-ignore
        const paramsObj = JSON.parse(params);
        return paramsObj;
      } else {
        return {};
      }
    }
    return queryParams;
  }, [queryParams, tableKey]);

  const setQueryParamsByKey = useCallback(
    <T extends object>(columns: Array<ExtendedColumn<T>>, values: QueryParamsValues) => {
      const params = buildParamsFromKey(tableKey, columns, values);
      setQueryParams(params);
    },
    [setQueryParams, tableKey]
  );

  return [queryParamsByKey, setQueryParamsByKey];
};
