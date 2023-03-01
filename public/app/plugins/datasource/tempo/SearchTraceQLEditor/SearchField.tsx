import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { FetchError, isFetchError } from '@grafana/runtime';
import { Select, HorizontalGroup } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TraceqlFilter } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { operators as allOperators } from '../traceql/traceql';

import { operatorSelectableValue } from './utils';

interface Props {
  filter: TraceqlFilter;
  datasource: TempoDatasource;
  updateFilter: (f: TraceqlFilter) => void;
  deleteFilter?: (f: TraceqlFilter) => void;
  setError: (error: FetchError) => void;
  isTagsLoading?: boolean;
  tags: string[];
  operators?: string[];
}
const SearchField = ({
  filter,
  datasource,
  updateFilter,
  deleteFilter,
  isTagsLoading,
  tags,
  setError,
  operators,
}: Props) => {
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [options, setOptions] = useState<Array<SelectableValue<string>>>([]);
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

  const loadOptions = useCallback(
    async (name: string) => {
      setIsLoadingValues(true);

      try {
        const options = await languageProvider.getOptionsV2(name);
        return options;
      } catch (error) {
        if (isFetchError(error) && error?.status === 404) {
          setError(error);
        } else if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
        return [];
      } finally {
        setIsLoadingValues(false);
      }
    },
    [setError, languageProvider]
  );

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        if (filter.tag) {
          setOptions(await loadOptions(filter.tag));
        }
      } catch (error) {
        // Display message if Tempo is connected but search 404's
        if (isFetchError(error) && error?.status === 404) {
          setError(error);
        } else if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchOptions();
  }, [languageProvider, loadOptions, setError, filter.tag]);

  return (
    <HorizontalGroup spacing={'none'}>
      {filter.type === 'dynamic' && (
        <Select
          inputId={`${filter.id}-tag`}
          isLoading={isTagsLoading}
          options={tags.map((t) => ({ label: t, value: t }))}
          onOpenMenu={() => tags}
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
        inputId={`${filter.id}-operator`}
        options={(operators || allOperators).map(operatorSelectableValue)}
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
        inputId={`${filter.id}-value`}
        isLoading={isLoadingValues}
        options={options}
        onOpenMenu={() => {
          if (filter.tag) {
            loadOptions(filter.tag);
          }
        }}
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
