import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { FetchError, isFetchError } from '@grafana/runtime';
import { InlineFieldRow, InlineField, Select, HorizontalGroup } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { operators } from '../traceql/traceql';
import { SearchFilter, TempoQuery } from '../types';

interface Props {
  datasource: TempoDatasource;

  query: TempoQuery;
  label: string;
  updateFilter: (f: SearchFilter) => void;
  deleteFilter: (t: string) => void;
  setError: (error: FetchError) => void;
  tagOptions?: Array<SelectableValue<string>>;
  isTagsLoading?: boolean;
  tag?: string;
}
const SearchField = ({ datasource, label, tag, updateFilter, isTagsLoading, setError }: Props) => {
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);

  const [filter, setFilter] = useState<SearchFilter>({ tag, operator: '=' });
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
    <InlineFieldRow>
      <InlineField label={label} labelWidth={14} grow>
        <HorizontalGroup spacing={'sm'}>
          <Select
            inputId={`${label}-operator`}
            options={operators.map((op) => ({ label: op, value: op }))}
            value={filter.operator}
            onChange={(v) => {
              setFilter({ ...filter, operator: v?.value });
            }}
            isClearable={false}
            aria-label={'select-service-name'}
            allowCustomValue={true}
          />
          <Select
            inputId="service"
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
            placeholder="Select a service"
            isClearable
            aria-label={'select-service-name'}
            allowCustomValue={true}
          />
        </HorizontalGroup>
      </InlineField>
    </InlineFieldRow>
  );
};

export default SearchField;
