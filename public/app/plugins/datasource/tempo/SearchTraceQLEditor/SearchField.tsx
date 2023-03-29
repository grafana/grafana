import { css } from '@emotion/css';
import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { FetchError, isFetchError } from '@grafana/runtime';
import { Select, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { operators as allOperators, stringOperators, numberOperators } from '../traceql/traceql';

import { operatorSelectableValue, scopeHelper } from './utils';

const getStyles = () => ({
  dropdown: css`
    box-shadow: none;
  `,
});

interface Props {
  filter: TraceqlFilter;
  datasource: TempoDatasource;
  updateFilter: (f: TraceqlFilter) => void;
  deleteFilter?: (f: TraceqlFilter) => void;
  setError: (error: FetchError) => void;
  isTagsLoading?: boolean;
  tags: string[];
}
const SearchField = ({ filter, datasource, updateFilter, deleteFilter, isTagsLoading, tags, setError }: Props) => {
  const styles = useStyles2(getStyles);
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [options, setOptions] = useState<Array<SelectableValue<string>>>([]);
  const [scopedTag, setScopedTag] = useState(scopeHelper(filter) + filter.tag);
  // We automatically change the operator to the regex op when users select 2 or more values
  // However, they expect this to be automatically rolled back to the previous operator once
  // there's only one value selected, so we store the previous operator and value
  const [prevOperator, setPrevOperator] = useState(filter.operator);
  const [prevValue, setPrevValue] = useState(filter.value);

  useEffect(() => {
    if (Array.isArray(filter.value) && filter.value.length > 1 && filter.operator !== '=~') {
      setPrevOperator(filter.operator);
      updateFilter({ ...filter, operator: '=~' });
    }
    if (Array.isArray(filter.value) && filter.value.length <= 1 && (prevValue?.length || 0) > 1) {
      updateFilter({ ...filter, operator: prevOperator, value: filter.value[0] });
    }
  }, [prevValue, prevOperator, updateFilter, filter]);

  useEffect(() => {
    setPrevValue(filter.value);
  }, [filter.value]);

  useEffect(() => {
    const newScopedTag = scopeHelper(filter) + filter.tag;
    if (newScopedTag !== scopedTag) {
      setScopedTag(newScopedTag);
    }
  }, [filter, scopedTag]);

  const updateOptions = useCallback(async () => {
    try {
      setIsLoadingValues(true);
      setOptions(await languageProvider.getOptionsV2(scopedTag));
    } catch (error) {
      // Display message if Tempo is connected but search 404's
      if (isFetchError(error) && error?.status === 404) {
        setError(error);
      } else if (error instanceof Error) {
        dispatch(notifyApp(createErrorNotification('Error', error)));
      }
    } finally {
      setIsLoadingValues(false);
    }
  }, [scopedTag, languageProvider, setError]);

  useEffect(() => {
    updateOptions();
  }, [updateOptions]);

  const scopeOptions = Object.values(TraceqlSearchScope).map((t) => ({ label: t, value: t }));

  // If all values have type string or int/float use a focused list of operators instead of all operators
  const optionsOfFirstType = options.filter((o) => o.type === options[0]?.type);
  const uniqueOptionType = options.length === optionsOfFirstType.length ? options[0]?.type : undefined;
  let operatorList = allOperators;
  switch (uniqueOptionType) {
    case 'string':
      operatorList = stringOperators;
      break;
    case 'int':
    case 'float':
      operatorList = numberOperators;
  }

  return (
    <HorizontalGroup spacing={'none'} width={'auto'}>
      {filter.type === 'dynamic' && (
        <Select
          className={styles.dropdown}
          inputId={`${filter.id}-scope`}
          options={scopeOptions}
          value={filter.scope}
          onChange={(v) => {
            updateFilter({ ...filter, scope: v?.value });
          }}
          placeholder="Select scope"
          aria-label={`select ${filter.id} scope`}
        />
      )}
      {filter.type === 'dynamic' && (
        <Select
          className={styles.dropdown}
          inputId={`${filter.id}-tag`}
          isLoading={isTagsLoading}
          options={tags.map((t) => ({ label: t, value: t }))}
          value={filter.tag}
          onChange={(v) => {
            updateFilter({ ...filter, tag: v?.value });
          }}
          placeholder="Select tag"
          isClearable
          aria-label={`select ${filter.id} tag`}
          allowCustomValue={true}
        />
      )}
      <Select
        className={styles.dropdown}
        inputId={`${filter.id}-operator`}
        options={operatorList.map(operatorSelectableValue)}
        value={filter.operator}
        onChange={(v) => {
          updateFilter({ ...filter, operator: v?.value });
        }}
        isClearable={false}
        aria-label={`select ${filter.id} operator`}
        allowCustomValue={true}
        width={8}
      />
      <Select
        className={styles.dropdown}
        inputId={`${filter.id}-value`}
        isLoading={isLoadingValues}
        options={options}
        value={filter.value}
        onChange={(val) => {
          if (Array.isArray(val)) {
            updateFilter({ ...filter, value: val.map((v) => v.value), valueType: val[0]?.type });
          } else {
            updateFilter({ ...filter, value: val?.value, valueType: val?.type });
          }
        }}
        placeholder="Select value"
        isClearable={false}
        aria-label={`select ${filter.id} value`}
        allowCustomValue={true}
        isMulti
      />
      {filter.type === 'dynamic' && (
        <AccessoryButton
          variant={'secondary'}
          icon={'times'}
          onClick={() => deleteFilter?.(filter)}
          tooltip={'Remove tag'}
          aria-label={`remove tag with ID ${filter.id}`}
        />
      )}
    </HorizontalGroup>
  );
};

export default SearchField;
