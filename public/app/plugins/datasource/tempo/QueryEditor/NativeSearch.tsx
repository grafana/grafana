import { css } from '@emotion/css';
import React, { useCallback, useState, useEffect, useMemo } from 'react';

import { GrafanaTheme2, isValidGoDuration, SelectableValue, toOption } from '@grafana/data';
import { FetchError, getTemplateSrv, isFetchError, TemplateSrv } from '@grafana/runtime';
import { InlineFieldRow, InlineField, Input, Alert, useStyles2, fuzzyMatch, Select } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { DEFAULT_LIMIT, TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { TempoQuery } from '../types';

import { TagsField } from './TagsField/TagsField';

interface Props {
  datasource: TempoDatasource;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
  onBlur?: () => void;
  onRunQuery: () => void;
}

const durationPlaceholder = 'e.g. 1.2s, 100ms';

const NativeSearch = ({ datasource, query, onChange, onBlur, onRunQuery }: Props) => {
  const styles = useStyles2(getStyles);
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
  const [serviceOptions, setServiceOptions] = useState<Array<SelectableValue<string>>>();
  const [spanOptions, setSpanOptions] = useState<Array<SelectableValue<string>>>();
  const [error, setError] = useState<Error | FetchError | null>(null);
  const [inputErrors, setInputErrors] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState<{
    serviceName: boolean;
    spanName: boolean;
  }>({
    serviceName: false,
    spanName: false,
  });

  const loadOptions = useCallback(
    async (name: string, query = '') => {
      const lpName = name === 'serviceName' ? 'service.name' : 'name';
      setIsLoading((prevValue) => ({ ...prevValue, [name]: true }));

      try {
        const options = await languageProvider.getOptionsV1(lpName);
        const filteredOptions = options.filter((item) => (item.value ? fuzzyMatch(item.value, query).found : false));
        return filteredOptions;
      } catch (error) {
        if (isFetchError(error) && error?.status === 404) {
          setError(error);
        } else if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
        return [];
      } finally {
        setIsLoading((prevValue) => ({ ...prevValue, [name]: false }));
      }
    },
    [languageProvider]
  );

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [services, spans] = await Promise.all([loadOptions('serviceName'), loadOptions('spanName')]);
        if (query.serviceName && getTemplateSrv().containsTemplate(query.serviceName)) {
          services.push(toOption(query.serviceName));
        }
        setServiceOptions(services);
        if (query.spanName && getTemplateSrv().containsTemplate(query.spanName)) {
          spans.push(toOption(query.spanName));
        }
        setSpanOptions(spans);
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
  }, [languageProvider, loadOptions, query.serviceName, query.spanName]);

  const onKeyDown = (keyEvent: React.KeyboardEvent) => {
    if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
      onRunQuery();
    }
  };

  const handleOnChange = useCallback(
    (value: string) => {
      onChange({
        ...query,
        search: value,
      });
    },
    [onChange, query]
  );

  const templateSrv: TemplateSrv = getTemplateSrv();

  return (
    <>
      <div className={styles.container}>
        <InlineFieldRow>
          <InlineField label="Service Name" labelWidth={14} grow>
            <Select
              inputId="service"
              options={serviceOptions}
              onOpenMenu={() => {
                loadOptions('serviceName');
              }}
              isLoading={isLoading.serviceName}
              value={serviceOptions?.find((v) => v?.value === query.serviceName) || query.serviceName}
              onChange={(v) => {
                onChange({
                  ...query,
                  serviceName: v?.value,
                });
              }}
              placeholder="Select a service"
              isClearable
              onKeyDown={onKeyDown}
              aria-label={'select-service-name'}
              allowCustomValue={true}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Span Name" labelWidth={14} grow>
            <Select
              inputId="spanName"
              options={spanOptions}
              onOpenMenu={() => {
                loadOptions('spanName');
              }}
              isLoading={isLoading.spanName}
              value={spanOptions?.find((v) => v?.value === query.spanName) || query.spanName}
              onChange={(v) => {
                onChange({
                  ...query,
                  spanName: v?.value,
                });
              }}
              placeholder="Select a span"
              isClearable
              onKeyDown={onKeyDown}
              aria-label={'select-span-name'}
              allowCustomValue={true}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Tags" labelWidth={14} grow tooltip="Values should be in logfmt.">
            <TagsField
              placeholder="http.status_code=200 error=true"
              value={query.search || ''}
              onChange={handleOnChange}
              onBlur={onBlur}
              datasource={datasource}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Min Duration" invalid={!!inputErrors.minDuration} labelWidth={14} grow>
            <Input
              id="minDuration"
              value={query.minDuration || ''}
              placeholder={durationPlaceholder}
              onBlur={() => {
                const templatedMinDuration = templateSrv.replace(query.minDuration ?? '');
                if (query.minDuration && !isValidGoDuration(templatedMinDuration)) {
                  setInputErrors({ ...inputErrors, minDuration: true });
                } else {
                  setInputErrors({ ...inputErrors, minDuration: false });
                }
              }}
              onChange={(v) =>
                onChange({
                  ...query,
                  minDuration: v.currentTarget.value,
                })
              }
              onKeyDown={onKeyDown}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Max Duration" invalid={!!inputErrors.maxDuration} labelWidth={14} grow>
            <Input
              id="maxDuration"
              value={query.maxDuration || ''}
              placeholder={durationPlaceholder}
              onBlur={() => {
                const templatedMaxDuration = templateSrv.replace(query.maxDuration ?? '');
                if (query.maxDuration && !isValidGoDuration(templatedMaxDuration)) {
                  setInputErrors({ ...inputErrors, maxDuration: true });
                } else {
                  setInputErrors({ ...inputErrors, maxDuration: false });
                }
              }}
              onChange={(v) =>
                onChange({
                  ...query,
                  maxDuration: v.currentTarget.value,
                })
              }
              onKeyDown={onKeyDown}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Limit"
            invalid={!!inputErrors.limit}
            labelWidth={14}
            grow
            tooltip="Maximum number of returned results"
          >
            <Input
              id="limit"
              value={query.limit || ''}
              placeholder={`Default: ${DEFAULT_LIMIT}`}
              type="number"
              onChange={(v) => {
                let limit = v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined;
                if (limit && (!Number.isInteger(limit) || limit <= 0)) {
                  setInputErrors({ ...inputErrors, limit: true });
                } else {
                  setInputErrors({ ...inputErrors, limit: false });
                }

                onChange({
                  ...query,
                  limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined,
                });
              }}
              onKeyDown={onKeyDown}
            />
          </InlineField>
        </InlineFieldRow>
      </div>
      {error ? (
        <Alert title="Unable to connect to Tempo search" severity="info" className={styles.alert}>
          Please ensure that Tempo is configured with search enabled. If you would like to hide this tab, you can
          configure it in the <a href={`/datasources/edit/${datasource.uid}`}>datasource settings</a>.
        </Alert>
      ) : null}
    </>
  );
};

export default NativeSearch;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    max-width: 500px;
  `,
  alert: css`
    max-width: 75ch;
    margin-top: ${theme.spacing(2)};
  `,
});
