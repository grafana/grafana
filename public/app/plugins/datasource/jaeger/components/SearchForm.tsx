import { css } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import { AsyncSelect, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { JaegerDatasource } from '../datasource';
import { JaegerQuery } from '../types';
import { transformToLogfmt } from '../util';
import { AdvancedOptions } from './AdvancedOptions';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';

type Props = {
  datasource: JaegerDatasource;
  query: JaegerQuery;
  onChange: (value: JaegerQuery) => void;
};
type Options = { dataSource: JaegerDatasource; url: string; notFoundLabel: string };

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

  const loadServices = async (
    { dataSource, url, notFoundLabel }: Options,
    loaderOfType: string
  ): Promise<Array<SelectableValue<string>>> => {
    setIsLoading((prevValue) => ({ ...prevValue, [loaderOfType]: true }));

    try {
      const services: string[] | null = await dataSource.metadataRequest(url);
      if (!services) {
        setIsLoading((prevValue) => ({ ...prevValue, [loaderOfType]: false }));
        return [{ label: notFoundLabel, value: notFoundLabel }];
      }

      const serviceOptions: SelectableValue[] = services.sort().map((service) => ({
        label: service,
        value: service,
      }));
      setIsLoading((prevValue) => ({ ...prevValue, [loaderOfType]: false }));
      return serviceOptions;
    } catch (error) {
      dispatch(notifyApp(createErrorNotification('Error', error)));
      setIsLoading((prevValue) => ({ ...prevValue, [loaderOfType]: false }));
      return [];
    }
  };

  useEffect(() => {
    const getServices = async () => {
      const services = await loadServices(
        {
          dataSource: datasource,
          url: '/api/services',
          notFoundLabel: 'No service found',
        },
        'services'
      );
      setServiceOptions(services);
    };
    getServices();
  }, [datasource]);

  useEffect(() => {
    const getOperations = async () => {
      const operations = await loadServices(
        {
          dataSource: datasource,
          url: `/api/services/${encodeURIComponent(query.service!)}/operations`,
          notFoundLabel: 'No operation found',
        },
        'operations'
      );
      setOperationOptions([allOperationsOption, ...operations]);
    };
    if (query.service) {
      getOperations();
    }
  }, [datasource, query.service]);

  return (
    <div className={css({ maxWidth: '500px' })}>
      <InlineFieldRow>
        <InlineField label="Service" labelWidth={14} grow>
          <AsyncSelect
            inputId="service"
            menuShouldPortal
            cacheOptions={false}
            loadOptions={() =>
              loadServices(
                {
                  dataSource: datasource,
                  url: '/api/services',
                  notFoundLabel: 'No service found',
                },
                'services'
              )
            }
            onOpenMenu={() =>
              loadServices(
                {
                  dataSource: datasource,
                  url: '/api/services',
                  notFoundLabel: 'No service found',
                },
                'services'
              )
            }
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
            defaultOptions
            aria-label={'select-service-name'}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Operation" labelWidth={14} grow disabled={!query.service}>
          <AsyncSelect
            inputId="operation"
            menuShouldPortal
            cacheOptions={false}
            loadOptions={() =>
              loadServices(
                {
                  dataSource: datasource,
                  url: `/api/services/${encodeURIComponent(query.service!)}/operations`,
                  notFoundLabel: 'No operation found',
                },
                'operations'
              )
            }
            onOpenMenu={() =>
              loadServices(
                {
                  dataSource: datasource,
                  url: `/api/services/${encodeURIComponent(query.service!)}/operations`,
                  notFoundLabel: 'No operation found',
                },
                'operations'
              )
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
            defaultOptions
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
