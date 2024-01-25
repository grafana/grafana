import { FormState } from 'final-form';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Form, FormSpy } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';

import { ExtendedColumn } from '../Elements/Table';
import { DEBOUNCE_DELAY, SEARCH_INPUT_FIELD_NAME } from '../Elements/Table/Filter/Filter.constants';
import { getFilteredData, getQueryParams } from '../Elements/Table/Filter/Filter.utils';
import { SelectDropdownField } from '../Elements/Table/Filter/components/fields/SelectDropdownField';
import { TextInputField } from '../Form/TextInput';

import { Messages } from './SearchFilter.messages';
import { getStyles } from './SearchFilter.styles';
import { QueryParamsValues } from './SearchFilter.types';
import { getFilterColumns, useQueryParamsByKey } from './SearchFilter.utils';

export interface SearchFilterProps<T extends object> {
  rawData: T[];
  onFilteredDataChange: (data: T[]) => void;
  columns: Array<ExtendedColumn<T>>;
  tableKey?: string;
  hasBackendFiltering?: boolean;
}

const SearchFilter = <T extends object>({
  columns,
  rawData,
  onFilteredDataChange,
  tableKey,
  hasBackendFiltering,
}: SearchFilterProps<T>) => {
  const filterColumns = useMemo(() => getFilterColumns(columns), [columns]);
  const styles = useStyles2(getStyles);
  const [queryParamsByKey, setQueryParamsByKey] = useQueryParamsByKey(tableKey);
  const initialValues = useMemo<QueryParamsValues>(
    () => getQueryParams(columns, queryParamsByKey),
    [columns, queryParamsByKey]
  );

  useEffect(() => {
    const queryParamsObj = getQueryParams(columns, queryParamsByKey);

    if (Object.keys(queryParamsByKey).length > 0 && !hasBackendFiltering) {
      const dataArray = getFilteredData(rawData, columns, queryParamsObj);
      onFilteredDataChange(dataArray);
    } else {
      onFilteredDataChange(rawData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParamsByKey, rawData]);

  const onSubmit = useCallback(
    (values: QueryParamsValues) => {
      setQueryParamsByKey(columns, values);
    },
    [columns, setQueryParamsByKey]
  );

  const handleFormValuesChange = debounce((state: FormState<QueryParamsValues>) => {
    onSubmit(state.values);
  }, DEBOUNCE_DELAY);

  return (
    <Form
      initialValues={initialValues}
      onSubmit={onSubmit}
      render={() => (
        <div className={styles.container}>
          <TextInputField
            name={SEARCH_INPUT_FIELD_NAME}
            data-testid={SEARCH_INPUT_FIELD_NAME}
            label={Messages.search.label}
            placeholder={Messages.search.placeholder}
            fieldClassName={styles.searchBar}
            placeholderIcon="search"
            clearable
          />
          <div className={styles.filtersContainer}>
            {filterColumns.map((col) => (
              <div key={col.id} className={styles.filter}>
                <SelectDropdownField column={col} />
              </div>
            ))}
          </div>
          {!hasBackendFiltering && (
            <FormSpy
              subscription={{
                values: true,
              }}
              onChange={handleFormValuesChange}
            />
          )}
        </div>
      )}
    />
  );
};

export default SearchFilter;
