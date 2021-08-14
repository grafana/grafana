import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const getServices = async () => {
      const services = await loadServices({
        dataSource: datasource,
        url: '/api/services',
        notFoundLabel: 'No service found',
      });
      setServiceOptions(services);
    };
    getServices();
  }, [datasource]);

  useEffect(() => {
    const getOperations = async () => {
      const operations = await loadServices({
        dataSource: datasource,
        url: `/api/services/${encodeURIComponent(query.service!)}/operations`,
        notFoundLabel: 'No operation found',
      });
      setOperationOptions([allOperationsOption, ...operations]);
    };
    if (query.service) {
      getOperations();
    }
  }, [datasource, query.service]);

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Service" labelWidth={21} grow>
          <Select
            menuShouldPortal
            options={serviceOptions}
            value={serviceOptions?.find((v) => v.value === query.service) || null}
            onChange={(v) => {
              onChange({
                ...query,
                service: v.value!,
                operation: query.service !== v.value ? undefined : query.operation,
              });
            }}
            menuPlacement="bottom"
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Operation" labelWidth={21} grow disabled={!query.service}>
          <Select
            menuShouldPortal
            options={operationOptions}
            value={operationOptions?.find((v) => v.value === query.operation) || null}
            onChange={(v) =>
              onChange({
                ...query,
                operation: v.value!,
              })
            }
            menuPlacement="bottom"
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Tags" labelWidth={21} grow>
          <Input
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
    </>
  );
}

type Options = { dataSource: JaegerDatasource; url: string; notFoundLabel: string };

const loadServices = async ({ dataSource, url, notFoundLabel }: Options): Promise<Array<SelectableValue<string>>> => {
  const services: string[] | null = await dataSource.metadataRequest(url);

  if (!services) {
    return [{ label: notFoundLabel, value: notFoundLabel }];
  }

  const serviceOptions: SelectableValue[] = services.sort().map((service) => ({
    label: service,
    value: service,
  }));

  return serviceOptions;
};
