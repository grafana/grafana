import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  InlineFieldRow,
  InlineField,
  Input,
  QueryField,
  SlatePrism,
  BracesPlugin,
  TypeaheadInput,
  TypeaheadOutput,
  AsyncSelect,
  Alert,
  useStyles2,
} from '@grafana/ui';
import { tokenizer } from '../syntax';
import Prism from 'prismjs';
import { Node } from 'slate';
import { css } from '@emotion/css';
import { GrafanaTheme2, isValidGoDuration, SelectableValue } from '@grafana/data';
import TempoLanguageProvider from '../language_provider';
import { TempoDatasource, TempoQuery } from '../datasource';
import { debounce } from 'lodash';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';

interface Props {
  datasource: TempoDatasource;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
  onBlur?: () => void;
  onRunQuery: () => void;
}

const PRISM_LANGUAGE = 'tempo';
const durationPlaceholder = 'e.g. 1.2s, 100ms';
const plugins = [
  BracesPlugin(),
  SlatePrism({
    onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
    getSyntax: () => PRISM_LANGUAGE,
  }),
];

Prism.languages[PRISM_LANGUAGE] = tokenizer;

const NativeSearch = ({ datasource, query, onChange, onBlur, onRunQuery }: Props) => {
  const styles = useStyles2(getStyles);
  const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
  const [hasSyntaxLoaded, setHasSyntaxLoaded] = useState(false);
  const [asyncServiceNameValue, setAsyncServiceNameValue] = useState<SelectableValue<any>>({
    value: '',
  });
  const [asyncSpanNameValue, setAsyncSpanNameValue] = useState<SelectableValue<any>>({
    value: '',
  });
  const [error, setError] = useState(null);
  const [inputErrors, setInputErrors] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState<{
    serviceName: boolean;
    spanName: boolean;
  }>({
    serviceName: false,
    spanName: false,
  });

  async function fetchOptionsCallback(nameType: string, lp: TempoLanguageProvider) {
    try {
      const res = await lp.getOptions(nameType === 'serviceName' ? 'service.name' : 'name');
      setIsLoading((prevValue) => ({ ...prevValue, [nameType]: false }));
      return res;
    } catch (error) {
      if (error?.status === 404) {
        setIsLoading((prevValue) => ({ ...prevValue, [nameType]: false }));
      } else {
        dispatch(notifyApp(createErrorNotification('Error', error)));
        setIsLoading((prevValue) => ({ ...prevValue, [nameType]: false }));
      }
      setError(error);
      return [];
    }
  }

  const loadOptionsOfType = useCallback(
    (nameType: string) => {
      setIsLoading((prevValue) => ({ ...prevValue, [nameType]: true }));
      return fetchOptionsCallback(nameType, languageProvider);
    },
    [languageProvider]
  );

  const fetchOptionsOfType = useCallback(
    (nameType: string) => debounce(() => loadOptionsOfType(nameType), 500, { leading: true, trailing: true }),
    [loadOptionsOfType]
  );

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        await languageProvider.start();
        fetchOptionsCallback('serviceName', languageProvider);
        fetchOptionsCallback('spanName', languageProvider);
        setHasSyntaxLoaded(true);
      } catch (error) {
        // Display message if Tempo is connected but search 404's
        if (error?.status === 404) {
          setError(error);
        } else {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
        setHasSyntaxLoaded(true);
      }
    };
    fetchOptions();
  }, [languageProvider, fetchOptionsOfType]);

  const onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    return await languageProvider.provideCompletionItems(typeahead);
  };

  const cleanText = (text: string) => {
    const splittedText = text.split(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g);
    if (splittedText.length > 1) {
      return splittedText[splittedText.length - 1];
    }
    return text;
  };

  const onKeyDown = (keyEvent: React.KeyboardEvent) => {
    if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
      onRunQuery();
    }
  };

  return (
    <>
      <div className={styles.container}>
        <InlineFieldRow>
          <InlineField label="Service Name" labelWidth={14} grow>
            <AsyncSelect
              inputId="service"
              menuShouldPortal
              cacheOptions={false}
              loadOptions={fetchOptionsOfType('serviceName')}
              onOpenMenu={fetchOptionsOfType('serviceName')}
              isLoading={isLoading.serviceName}
              value={asyncServiceNameValue.value}
              onChange={(v) => {
                setAsyncServiceNameValue({
                  value: v,
                });
                onChange({
                  ...query,
                  serviceName: v?.value || undefined,
                });
              }}
              placeholder="Select a service"
              isClearable
              defaultOptions
              onKeyDown={onKeyDown}
              aria-label={'select-service-name'}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Span Name" labelWidth={14} grow>
            <AsyncSelect
              inputId="spanName"
              menuShouldPortal
              cacheOptions={false}
              loadOptions={fetchOptionsOfType('spanName')}
              onOpenMenu={fetchOptionsOfType('spanName')}
              isLoading={isLoading.spanName}
              value={asyncSpanNameValue.value}
              onChange={(v) => {
                setAsyncSpanNameValue({ value: v });
                onChange({
                  ...query,
                  spanName: v?.value || undefined,
                });
              }}
              placeholder="Select a span"
              isClearable
              defaultOptions
              onKeyDown={onKeyDown}
              aria-label={'select-span-name'}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Tags" labelWidth={14} grow tooltip="Values should be in the logfmt format.">
            <QueryField
              additionalPlugins={plugins}
              query={query.search}
              onTypeahead={onTypeahead}
              onBlur={onBlur}
              onChange={(value) => {
                onChange({
                  ...query,
                  search: value,
                });
              }}
              placeholder="http.status_code=200 error=true"
              cleanText={cleanText}
              onRunQuery={onRunQuery}
              syntaxLoaded={hasSyntaxLoaded}
              portalOrigin="tempo"
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
                if (query.minDuration && !isValidGoDuration(query.minDuration)) {
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
                if (query.maxDuration && !isValidGoDuration(query.maxDuration)) {
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
            tooltip="Maximum numbers of returned results"
          >
            <Input
              id="limit"
              value={query.limit || ''}
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
