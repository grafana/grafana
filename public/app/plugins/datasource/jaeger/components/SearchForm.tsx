import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { JaegerDatasource } from '../datasource';
import { JaegerQuery } from '../types';

type Props = {
  datasource: JaegerDatasource;
  query: JaegerQuery;
  onChange: (value: JaegerQuery) => void;
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
      setOperationOptions(operations);
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
          onChange={(v) =>
            onChange({
              ...query,
              service: v.value!,
            })
          }
          menuPlacement="bottom"
        />
      </InlineField>

      <InlineField label="Operation">
        <Select
          options={operationOptions}
          value={{ label: query.operation, value: query.operation }}
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
