import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { FetchError, isFetchError } from '@grafana/runtime';
import { Select, HorizontalGroup, Button } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { SearchFilter } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { operators } from '../traceql/traceql';

interface Props {
  filter: SearchFilter;
  datasource: TempoDatasource;
  updateFilter: (f: SearchFilter) => void;
  deleteFilter?: (f: SearchFilter) => void;
  setError: (error: FetchError) => void;
  isTagsLoading?: boolean;
  tags: string[];
}
const SearchField = ({ filter, datasource, updateFilter, deleteFilter, isTagsLoading, tags, setError }: Props) => {
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [options, setOptions] = useState<Array<SelectableValue<string>>>([]);

  useEffect(() => {
    if (Array.isArray(filter.value) && filter.value.length > 1 && !['=~', '!~'].includes(filter.operator || '')) {
      updateFilter({ ...filter, operator: '=~' });
    }
  }, [updateFilter, filter]);

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
        onChange={(val) => {
          if (Array.isArray(val)) {
            updateFilter({ ...filter, value: val.map((v) => v.value), valueType: val[0]?.type });
          } else {
            updateFilter({ ...filter, value: val?.value, valueType: val?.type });
          }
        }}
        placeholder="Select a value"
        isClearable
        aria-label={`select-${filter.id}-value`}
        allowCustomValue={true}
        isMulti
      />
      {filter.type === 'dynamic' && (
        <Button variant={'secondary'} onClick={() => deleteFilter?.(filter)} tooltip={'Remove tag'}>
          x
        </Button>
      )}
    </HorizontalGroup>
  );
};

export default SearchField;
