import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { TemporaryAlert } from '@grafana/o11y-ds-frontend';
import { getTemplateSrv } from '@grafana/runtime';
import { fuzzyMatch, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import { JaegerDatasource } from '../datasource';
import { JaegerQuery } from '../types';

const durationPlaceholder = 'e.g. 1.2s, 100ms, 500us';

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
  const [alertText, setAlertText] = useState('');
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
        setAlertText('');
        return filteredOptions;
      } catch (error) {
        if (error instanceof Error) {
          setAlertText(`Error: ${error.message}`);
        }
        return [];
      } finally {
        setIsLoading((prevValue) => ({ ...prevValue, [loaderOfType]: false }));
      }
    },
    [datasource]
  );

  useEffect(() => {
    const getServices = async () => {
      const services = await loadOptions('services', 'services');
      if (query.service && getTemplateSrv().containsTemplate(query.service)) {
        services.push(toOption(query.service));
      }
      setServiceOptions(services);
    };
    getServices();
  }, [datasource, loadOptions, query.service]);

  useEffect(() => {
    const getOperations = async () => {
      const operations = await loadOptions(
        `services/${encodeURIComponent(getTemplateSrv().replace(query.service!))}/operations`,
        'operations'
      );
      if (query.operation && getTemplateSrv().containsTemplate(query.operation)) {
        operations.push(toOption(query.operation));
      }
      setOperationOptions([allOperationsOption, ...operations]);
    };
    if (query.service) {
      getOperations();
    }
  }, [datasource, query.service, loadOptions, query.operation]);

  return (
    <>
      <div className={css({ maxWidth: '500px' })}>
        <InlineFieldRow>
          <InlineField label="Service Name" labelWidth={14} grow>
            <Select
              inputId="service"
              options={serviceOptions}
              onOpenMenu={() => loadOptions('services', 'services')}
              isLoading={isLoading.services}
              value={serviceOptions?.find((v) => v?.value === query.service) || undefined}
              placeholder="Select a service"
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
              allowCustomValue={true}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Operation Name" labelWidth={14} grow disabled={!query.service}>
            <Select
              inputId="operation"
              options={operationOptions}
              onOpenMenu={() =>
                loadOptions(
                  `services/${encodeURIComponent(getTemplateSrv().replace(query.service!))}/operations`,
                  'operations'
                )
              }
              isLoading={isLoading.operations}
              value={operationOptions?.find((v) => v.value === query.operation) || null}
              placeholder="Select an operation"
              onChange={(v) =>
                onChange({
                  ...query,
                  operation: v?.value! || undefined,
                })
              }
              menuPlacement="bottom"
              isClearable
              aria-label={'select-operation-name'}
              allowCustomValue={true}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Tags" labelWidth={14} grow tooltip="Values should be in logfmt.">
            <Input
              id="tags"
              value={query.tags}
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
        <InlineFieldRow>
          <InlineField label="Min Duration" labelWidth={14} grow>
            <Input
              id="minDuration"
              name="minDuration"
              value={query.minDuration || ''}
              placeholder={durationPlaceholder}
              onChange={(v) =>
                onChange({
                  ...query,
                  minDuration: v.currentTarget.value,
                })
              }
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Max Duration" labelWidth={14} grow>
            <Input
              id="maxDuration"
              name="maxDuration"
              value={query.maxDuration || ''}
              placeholder={durationPlaceholder}
              onChange={(v) =>
                onChange({
                  ...query,
                  maxDuration: v.currentTarget.value,
                })
              }
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Limit" labelWidth={14} grow tooltip="Maximum number of returned results">
            <Input
              id="limit"
              name="limit"
              value={query.limit || ''}
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
      </div>
      {alertText && <TemporaryAlert text={alertText} severity="error" />}
    </>
  );
}

export default SearchForm;
