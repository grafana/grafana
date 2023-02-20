import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { FetchError, isFetchError } from '@grafana/runtime';
import { Select, HorizontalGroup } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { operators } from '../traceql/traceql';
import { SearchFilter } from '../types';

interface Props {
  id: string;
  datasource: TempoDatasource;
  updateFilter: (f: SearchFilter) => void;
  deleteFilter: (t: string) => void;
  setError: (error: FetchError) => void;
  tagOptions?: Array<SelectableValue<string>>;
  isTagsLoading?: boolean;
  tag?: string;
  operator?: string;
}
const SearchField = ({ id, datasource, tag, operator, updateFilter, isTagsLoading, setError }: Props) => {
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);

  const [filter, setFilter] = useState<SearchFilter>({ id, tag, operator: operator || '=' });
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [options, setOptions] = useState<Array<SelectableValue<string>>>([]);

  useEffect(() => {
    updateFilter(filter);
  }, [updateFilter, filter]);

  const loadOptions = useCallback(
    async (name: string, query = '') => {
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
    <HorizontalGroup spacing={'xs'}>
      <Select
        inputId={`${id}-operator`}
        options={operators.map((op) => ({ label: op, value: op }))}
        value={filter.operator}
        onChange={(v) => {
          setFilter({ ...filter, operator: v?.value });
        }}
        isClearable={false}
        disabled={!!operator}
        aria-label={`select-${id}-operator`}
        allowCustomValue={true}
        width={8}
      />
      <Select
        inputId={`${id}-value`}
        isLoading={isLoadingValues}
        options={options}
        onOpenMenu={() => {
          if (filter.tag) {
            loadOptions(filter.tag);
          }
        }}
        value={filter.value}
        onChange={(v) => {
          setFilter({ ...filter, value: v?.value });
        }}
        placeholder="Select a value"
        isClearable
        aria-label={`select-${id}-value`}
        allowCustomValue={true}
        width={filter.value ? undefined : 18}
      />
    </HorizontalGroup>
  );
};

export default SearchField;
