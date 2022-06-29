import { RadioButtonGroupField } from '@percona/platform-core';
import { FormApi } from 'final-form';
import { debounce } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Field, Form, FormSpy } from 'react-final-form';

import { IconButton, Input, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';

import { FilterFieldTypes } from '..';

import {
  ALL_LABEL,
  ALL_VALUE,
  DEBOUNCE_DELAY,
  SEARCH_INPUT_FIELD_NAME,
  SEARCH_SELECT_FIELD_NAME,
} from './Filter.constants';
import { Messages } from './Filter.messages';
import { getStyles } from './Filter.styles';
import { FilterProps } from './Filter.types';
import {
  buildColumnOptions,
  buildEmptyValues,
  buildObjForQueryParams,
  buildSearchOptions,
  getQueryParams,
  isInOptions,
  isOtherThanTextType,
  isValueInTextColumn,
} from './Filter.utils';

export const Filter = ({ columns, rawData, setFilteredData }: FilterProps) => {
  const [openCollapse, setOpenCollapse] = useState(false);
  const [openSearchFields, setOpenSearchFields] = useState(false);
  const styles = useStyles2(getStyles);
  const [queryParams, setQueryParams] = useQueryParams();

  const searchColumnsOptions = useMemo(() => buildSearchOptions(columns), [columns]);

  const onFormChange = debounce(
    (values: Record<string, any>) => setQueryParams(buildObjForQueryParams(columns, values)),
    DEBOUNCE_DELAY
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialValues = useMemo(() => getQueryParams(columns, queryParams), []);
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
    const queryParamsObj = getQueryParams(columns, queryParams);
    if (Object.keys(queryParams).length > 0) {
      const dataArray = rawData.filter(
        (filterValue) =>
          isValueInTextColumn(columns, filterValue, queryParamsObj) &&
          isInOptions(columns, filterValue, queryParamsObj, FilterFieldTypes.DROPDOWN) &&
          isInOptions(columns, filterValue, queryParamsObj, FilterFieldTypes.RADIO_BUTTON)
      );
      setFilteredData(dataArray);
    } else {
      setFilteredData(rawData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams, rawData]);

  const showAdvanceFilter = useMemo(
    () => isOtherThanTextType(columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Form
      initialValues={initialValues}
      onSubmit={() => {}}
      render={({ handleSubmit, form }) => (
        <form
          onSubmit={handleSubmit}
          role="form"
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
              />
              {openSearchFields && (
                <div className={styles.searchFields}>
                  <Field name={SEARCH_SELECT_FIELD_NAME}>
                    {({ input }) => (
                      <SelectField
                        defaultValue={{ value: ALL_VALUE, label: ALL_LABEL }}
                        className={styles.searchSelect}
                        options={searchColumnsOptions ?? []}
                        {...input}
                        data-testid={SEARCH_SELECT_FIELD_NAME}
                      />
                    )}
                  </Field>
                  <Field name={SEARCH_INPUT_FIELD_NAME}>
                    {({ input }) => (
                      <Input
                        type="text"
                        placeholder={Messages.searchPlaceholder}
                        {...input}
                        data-testid={SEARCH_INPUT_FIELD_NAME}
                        autoFocus={true}
                      />
                    )}
                  </Field>
                </div>
              )}
              {showAdvanceFilter && (
                <IconButton
                  className={styles.icon}
                  name="filter"
                  size="xl"
                  onClick={() => setOpenCollapse((open) => !open)}
                  data-testid="advance-filter-button"
                />
              )}
              <IconButton
                className={styles.icon}
                name="times"
                size="xl"
                onClick={() => onClearAll(form)}
                data-testid="clear-all-button"
              />
            </div>
          </div>
          {showAdvanceFilter && openCollapse && (
            <div className={styles.advanceFilter}>
              {columns.map((column) => {
                const columnOptions = buildColumnOptions(column);
                if (column.type === FilterFieldTypes.DROPDOWN) {
                  return (
                    <div>
                      <Field name={`${column.accessor}`}>
                        {({ input }) => (
                          <SelectField
                            options={columnOptions}
                            defaultValue={{ value: ALL_VALUE, label: ALL_LABEL }}
                            label={column.label ?? column.Header}
                            {...input}
                            data-testid="select-dropdown"
                          />
                        )}
                      </Field>
                    </div>
                  );
                }
                if (column.type === FilterFieldTypes.RADIO_BUTTON) {
                  return (
                    <div>
                      <RadioButtonGroupField
                        options={columnOptions}
                        defaultValue={ALL_VALUE}
                        name={`${column.accessor}`}
                        label={column.label ?? column.Header}
                        fullWidth
                        data-testid="radio-button"
                      />
                    </div>
                  );
                }
                return <></>;
              })}
            </div>
          )}
          <FormSpy onChange={(state) => onFormChange(state.values)}></FormSpy>
        </form>
      )}
    />
  );
};
