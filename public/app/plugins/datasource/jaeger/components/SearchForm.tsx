import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { JaegerDatasource } from '../datasource';
import { JaegerQuery } from '../types';
import { transformToLogfmt } from '../util';

const durationPlaceholder = 'e.g. 1.2s, 100ms, 500us';

type Props = {
  datasource: JaegerDatasource;
  query: JaegerQuery;
  onChange: (value: JaegerQuery) => void;
};

export const ALL_OPERATIONS_KEY = '[ALL]';
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
    <InlineFieldRow>
      <InlineField label="Service">
        <Select
          options={serviceOptions}
          value={{ label: query.service, value: query.service }}
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

      <InlineField label="Operation">
        <Select
          options={operationOptions}
          value={operationOptions?.find((v) => v.value === query.operation)}
          onChange={(v) =>
            onChange({
              ...query,
              operation: v.value!,
            })
          }
          menuPlacement="bottom"
        />
      </InlineField>

      <InlineField label="Tags">
        <Input
          value={transformToLogfmt(query.tags)}
          onChange={(v) =>
            onChange({
              ...query,
              tags: v.currentTarget.value,
            })
          }
        />
      </InlineField>

      <InlineField label="Min Duration">
        <Input
          value={query.minDuration}
          placeholder={durationPlaceholder}
          onChange={(v) =>
            onChange({
              ...query,
              minDuration: v.currentTarget.value,
            })
          }
        />
      </InlineField>

      <InlineField label="Max Duration">
        <Input
          value={query.maxDuration}
          placeholder={durationPlaceholder}
          onChange={(v) =>
            onChange({
              ...query,
              maxDuration: v.currentTarget.value,
            })
          }
        />
      </InlineField>

      <InlineField label="Limit">
        <Input
          value={query.limit}
          type="number"
          onChange={(v) =>
            onChange({
              ...query,
              limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined,
            })
          }
        />
      </InlineField>
    </InlineFieldRow>
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
