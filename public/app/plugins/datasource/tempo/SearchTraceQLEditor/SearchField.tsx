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
  filter: SearchFilter;
  datasource: TempoDatasource;
  updateFilter: (f: SearchFilter) => void;
  setError: (error: FetchError) => void;
  isTagsLoading?: boolean;
  tags: string[];
}
const SearchField = ({ filter, datasource, updateFilter, isTagsLoading, tags, setError }: Props) => {
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [options, setOptions] = useState<Array<SelectableValue<string>>>([]);

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
          placeholder="Select a tag"
          isClearable
          aria-label={`select-${filter.id}-tag`}
          allowCustomValue={true}
          width={filter.tag ? undefined : 18}
        />
      )}
      <Select
        inputId={`${filter.id}-operator`}
        options={operators.map((op) => ({ label: op, value: op }))}
        value={filter.operator}
        onChange={(v) => {
          updateFilter({ ...filter, operator: v?.value });
        }}
        isClearable={false}
        aria-label={`select-${filter.id}-operator`}
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
        onChange={(v) => {
          updateFilter({ ...filter, value: v?.value });
        }}
        placeholder="Select a value"
        isClearable
        aria-label={`select-${filter.id}-value`}
        allowCustomValue={true}
        width={filter.value ? undefined : 18}
      />
    </HorizontalGroup>
  );
};

export default SearchField;
