import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { fuzzyMatch, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { JaegerDatasource } from '../datasource';
import { JaegerQuery } from '../types';
import { transformToLogfmt } from '../util';

import { AdvancedOptions } from './AdvancedOptions';

type Props = {
  datasource: JaegerDatasource;
  query: JaegerQuery;
  onChange: (value: JaegerQuery) => void;
};

export const ALL_OPERATIONS_KEY = 'All';
const allOperationsOption: SelectableValue<string> = {
  label: ALL_OPERATIONS_KEY,
  value: undefined,
};

export function SearchForm({ datasource, query, onChange }: Props) {
  const [serviceOptions, setServiceOptions] = useState<Array<SelectableValue<string>>>();
  const [operationOptions, setOperationOptions] = useState<Array<SelectableValue<string>>>();
  const [isLoading, setIsLoading] = useState<{
    services: boolean;
    operations: boolean;
  }>({
    services: false,
    operations: false,
  });

  const loadOptions = useCallback(
    async (url: string, loaderOfType: string, query = ''): Promise<Array<SelectableValue<string>>> => {
      setIsLoading((prevValue) => ({ ...prevValue, [loaderOfType]: true }));

      try {
        const values: string[] | null = await datasource.metadataRequest(url);
        if (!values) {
          return [{ label: `No ${loaderOfType} found`, value: `No ${loaderOfType} found` }];
        }

        const options: SelectableValue[] = values.sort().map((option) => ({
          label: option,
          value: option,
        }));

        const filteredOptions = options.filter((item) => (item.value ? fuzzyMatch(item.value, query).found : false));
        return filteredOptions;
      } catch (error) {
        dispatch(notifyApp(createErrorNotification('Error', error)));
        return [];
      } finally {
        setIsLoading((prevValue) => ({ ...prevValue, [loaderOfType]: false }));
      }
    },
    [datasource]
  );

  useEffect(() => {
    const getServices = async () => {
      const services = await loadOptions('/api/services', 'services');
      setServiceOptions(services);
    };
    getServices();
  }, [datasource, loadOptions]);

  useEffect(() => {
    const getOperations = async () => {
      const operations = await loadOptions(
        `/api/services/${encodeURIComponent(query.service!)}/operations`,
        'operations'
      );
      setOperationOptions([allOperationsOption, ...operations]);
    };
    if (query.service) {
      getOperations();
    }
  }, [datasource, query.service, loadOptions]);

  return (
    <div className={css({ maxWidth: '500px' })}>
      <InlineFieldRow>
        <InlineField label="Service" labelWidth={14} grow>
          <Select
            inputId="service"
            options={serviceOptions}
            onOpenMenu={() => loadOptions('/api/services', 'services')}
            isLoading={isLoading.services}
            value={serviceOptions?.find((v) => v?.value === query.service) || undefined}
            onChange={(v) =>
              onChange({
                ...query,
                service: v?.value!,
                operation: query.service !== v?.value ? undefined : query.operation,
              })
            }
            menuPlacement="bottom"
            isClearable
            aria-label={'select-service-name'}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Operation" labelWidth={14} grow disabled={!query.service}>
          <Select
            inputId="operation"
            options={operationOptions}
            onOpenMenu={() =>
              loadOptions(`/api/services/${encodeURIComponent(query.service!)}/operations`, 'operations')
            }
            isLoading={isLoading.operations}
            value={operationOptions?.find((v) => v.value === query.operation) || null}
            onChange={(v) =>
              onChange({
                ...query,
                operation: v?.value! || undefined,
              })
            }
            menuPlacement="bottom"
            isClearable
            aria-label={'select-operation-name'}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Tags" labelWidth={14} grow>
          <Input
            id="tags"
            value={transformToLogfmt(query.tags)}
            placeholder="http.status_code=200 error=true"
            onChange={(v) =>
              onChange({
                ...query,
                tags: v.currentTarget.value,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
      <AdvancedOptions query={query} onChange={onChange} />
    </div>
  );
}

export default SearchForm;
