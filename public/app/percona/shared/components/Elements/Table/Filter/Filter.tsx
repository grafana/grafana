/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion */
import { FormApi } from 'final-form';
import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { Form, FormSpy } from 'react-final-form';

import { IconButton, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { FilterFieldTypes } from '..';

import { DEBOUNCE_DELAY, SEARCH_INPUT_FIELD_NAME, SEARCH_SELECT_FIELD_NAME } from './Filter.constants';
import { Messages } from './Filter.messages';
import { getStyles } from './Filter.styles';
import { FilterProps } from './Filter.types';
import {
  buildEmptyValues,
  buildParamsFromKey,
  buildSearchOptions,
  getFilteredData,
  getQueryParams,
  isOtherThanTextType,
} from './Filter.utils';
import { RadioButtonField } from './components/fields/RadioButtonField';
import { SearchTextField } from './components/fields/SearchTextField';
import { SelectColumnField } from './components/fields/SelectColumnField';
import { SelectDropdownField } from './components/fields/SelectDropdownField';

export const Filter = <T,>({
  columns,
  rawData,
  setFilteredData,
  hasBackendFiltering = false,
  tableKey,
}: FilterProps<T>) => {
  const [openCollapse, setOpenCollapse] = useState(false);
  const [openSearchFields, setOpenSearchFields] = useState(false);
  const styles = useStyles2(getStyles);
  const [queryParams, setQueryParams] = useQueryParams();

  const queryParamsByKey = useMemo(() => {
    if (tableKey) {
      // eslint-disable-next-line
      const params = queryParams[tableKey] as any;

      if (params) {
        const paramsObj = JSON.parse(params);
        return paramsObj;
      } else {
        return {};
      }
    }
    return queryParams;
  }, [queryParams, tableKey]);

  const searchColumnsOptions = useMemo(() => buildSearchOptions(columns), [columns]);

  const onFormChange = debounce(
    (values: Record<string, any>) => setQueryParams(buildParamsFromKey(tableKey, columns, values)),
    DEBOUNCE_DELAY
  );
  const onSubmit = (values: Record<string, any>) => {
    setQueryParams(buildParamsFromKey(tableKey, columns, values));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialValues = useMemo(() => getQueryParams(columns, queryParamsByKey), []);
  const onClearAll = (form: FormApi) => {
    form.initialize(buildEmptyValues(columns));
    setOpenCollapse(false);
    setOpenSearchFields(false);
  };

  useEffect(() => {
    const numberOfParams = Object.keys(initialValues).length;
    if (
      numberOfParams > 0 &&
      numberOfParams <= 2 &&
      !initialValues[SEARCH_INPUT_FIELD_NAME] &&
      !initialValues[SEARCH_SELECT_FIELD_NAME]
    ) {
      setOpenCollapse(true);
    }
    if (numberOfParams > 2) {
      setOpenCollapse(true);
      setOpenSearchFields(true);
    }
    if (numberOfParams === 2 && initialValues[SEARCH_INPUT_FIELD_NAME] && initialValues[SEARCH_SELECT_FIELD_NAME]) {
      setOpenSearchFields(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const queryParamsObj = getQueryParams(columns, queryParamsByKey);
    if (Object.keys(queryParamsByKey).length > 0 && !hasBackendFiltering) {
      const dataArray = getFilteredData(rawData, columns, queryParamsObj);
      setFilteredData(dataArray);
    } else {
      setFilteredData(rawData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParamsByKey, rawData]);

  const showAdvanceFilter = useMemo(
    () => isOtherThanTextType(columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Form
      initialValues={initialValues}
      onSubmit={onSubmit}
      render={({ handleSubmit, form }) => (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <form
          onSubmit={handleSubmit}
          onKeyPress={(e) => {
            e.key === 'Enter' && e.preventDefault();
          }}
        >
          <div className={styles.filterWrapper}>
            <span className={styles.filterLabel} data-testid="filter">
              {Messages.filterLabel}
            </span>
            <div className={styles.filterActionsWrapper}>
              <IconButton
                className={styles.icon}
                name="search"
                size="xl"
                onClick={() => setOpenSearchFields((value) => !value)}
                data-testid="open-search-fields"
                aria-label="Open search fields"
              />
              {openSearchFields && (
                <div className={styles.searchFields}>
                  <SelectColumnField searchColumnsOptions={searchColumnsOptions} />
                  <SearchTextField />
                </div>
              )}
              {showAdvanceFilter && (
                <IconButton
                  aria-label="Toggle advanced filter"
                  className={styles.icon}
                  name="filter"
                  size="xl"
                  onClick={() => setOpenCollapse((open) => !open)}
                  data-testid="advance-filter-button"
                />
              )}
              <IconButton
                aria-label="Clear filter"
                className={styles.icon}
                name="times"
                size="xl"
                onClick={() => onClearAll(form)}
                data-testid="clear-all-button"
              />
              {hasBackendFiltering && (
                <IconButton
                  // todo: add aria-label
                  aria-label=""
                  className={styles.icon}
                  name="check"
                  size="xl"
                  type="submit"
                  data-testid="submit-button"
                />
              )}
            </div>
          </div>
          {showAdvanceFilter && openCollapse && (
            <div className={styles.advanceFilter}>
              {columns.map(
                (column) =>
                  (column.type === FilterFieldTypes.DROPDOWN && <SelectDropdownField column={column} />) ||
                  (column.type === FilterFieldTypes.RADIO_BUTTON && <RadioButtonField column={column} />)
              )}
            </div>
          )}
          {!hasBackendFiltering && (
            <FormSpy
              subscription={{
                values: true,
              }}
              onChange={(state) => onFormChange(state.values)}
            ></FormSpy>
          )}
        </form>
      )}
    />
  );
};
