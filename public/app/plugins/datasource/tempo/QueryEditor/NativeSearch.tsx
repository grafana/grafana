import { css } from '@emotion/css';
import Prism from 'prismjs';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Node } from 'slate';

import { GrafanaTheme2, isValidGoDuration, SelectableValue } from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import {
  InlineFieldRow,
  InlineField,
  Input,
  QueryField,
  SlatePrism,
  BracesPlugin,
  TypeaheadInput,
  TypeaheadOutput,
  Alert,
  useStyles2,
  fuzzyMatch,
  Select,
} from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { TempoDatasource, TempoQuery } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { tokenizer } from '../syntax';

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
  const [serviceOptions, setServiceOptions] = useState<Array<SelectableValue<string>>>();
  const [spanOptions, setSpanOptions] = useState<Array<SelectableValue<string>>>();
  const [error, setError] = useState(null);
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
        const options = await languageProvider.getOptions(lpName);
        const filteredOptions = options.filter((item) => (item.value ? fuzzyMatch(item.value, query).found : false));
        return filteredOptions;
      } catch (error) {
        if (error?.status === 404) {
          setError(error);
        } else {
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
        setServiceOptions(services);
        setSpanOptions(spans);
      } catch (error) {
        // Display message if Tempo is connected but search 404's
        if (error?.status === 404) {
          setError(error);
        } else {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchOptions();
  }, [languageProvider, loadOptions]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await languageProvider.start();
        setHasSyntaxLoaded(true);
      } catch (error) {
        dispatch(notifyApp(createErrorNotification('Error', error)));
      }
    };
    fetchTags();
  }, [languageProvider]);

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
              value={serviceOptions?.find((v) => v?.value === query.serviceName) || undefined}
              onChange={(v) => {
                onChange({
                  ...query,
                  serviceName: v?.value || undefined,
                });
              }}
              placeholder="Select a service"
              isClearable
              onKeyDown={onKeyDown}
              aria-label={'select-service-name'}
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
              value={spanOptions?.find((v) => v?.value === query.spanName) || undefined}
              onChange={(v) => {
                onChange({
                  ...query,
                  spanName: v?.value || undefined,
                });
              }}
              placeholder="Select a span"
              isClearable
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
