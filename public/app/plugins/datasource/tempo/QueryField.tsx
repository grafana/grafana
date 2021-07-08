import { css } from '@emotion/css';
import { ExploreQueryFieldProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  BracesPlugin,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  LegacyForms,
  QueryField,
  RadioButtonGroup,
  SlatePrism,
  TypeaheadInput,
  TypeaheadOutput,
} from '@grafana/ui';
import Prism from 'prismjs';
import React, { useEffect, useState } from 'react';
import { Node } from 'slate';
import { LokiQueryField } from '../loki/components/LokiQueryField';
import LokiDatasource from '../loki/datasource';
import { AdvancedOptions } from './AdvancedOptions';
import { TempoDatasource, TempoQuery, TempoQueryType } from './datasource';
import { tokenizer } from './syntax';

type Props = ExploreQueryFieldProps<TempoDatasource, TempoQuery>;
const DEFAULT_QUERY_TYPE: TempoQueryType = 'traceId';

const PRISM_LANGUAGE = 'tempo';
const plugins = [
  BracesPlugin(),
  SlatePrism({
    onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
    getSyntax: () => PRISM_LANGUAGE,
  }),
];

Prism.languages[PRISM_LANGUAGE] = tokenizer;

export function TempoQueryField({ datasource, onChange, query, onBlur, onRunQuery }: Props) {
  const [syntaxLoaded, setSyntaxLoaded] = useState(false);
  const [lokiDataSource, setLokiDataSource] = useState<LokiDatasource>();

  useEffect(() => {
    async function fetchAutocomplete() {
      await datasource.languageProvider.start();
      setSyntaxLoaded(true);
    }

    if (query.queryType === 'search') {
      fetchAutocomplete();
    }
  }, [datasource.languageProvider, query.queryType]);

  useEffect(() => {
    async function getLinkedDataSource() {
      const linkedDatasourceUid = datasource.tracesToLogs?.datasourceUid;
      if (linkedDatasourceUid) {
        const dsSrv = getDataSourceSrv();
        const linkedDatasource = (await dsSrv.get(linkedDatasourceUid)) as LokiDatasource;
        setLokiDataSource(linkedDatasource);
      }
    }

    if (query.queryType === 'lokiSearch' && !lokiDataSource) {
      getLinkedDataSource();
    }
  }, [datasource.tracesToLogs?.datasourceUid, lokiDataSource, query.queryType]);

  const onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const languageProvider = datasource.languageProvider;

    return await languageProvider.provideCompletionItems(typeahead);
  };

  // get the last text after a space delimiter
  const cleanText = (text: string) => {
    const splittedText = text.split(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g);
    if (splittedText.length > 1) {
      return splittedText[splittedText.length - 1];
    }
    return text;
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query type">
          <RadioButtonGroup<TempoQueryType>
            options={[
              { value: 'search', label: 'Search' },
              { value: 'traceId', label: 'TraceID' },
              { value: 'lokiSearch', label: 'Search in Loki' },
            ]}
            value={query.queryType || DEFAULT_QUERY_TYPE}
            onChange={(v) =>
              onChange({
                ...query,
                queryType: v,
              })
            }
            size="md"
          />
        </InlineField>
      </InlineFieldRow>
      {query.queryType === 'lokiSearch' && lokiDataSource && (
        <>
          <InlineLabel>Tempo uses {lokiDataSource.name} to find traces.</InlineLabel>

          <LokiQueryField
            datasource={lokiDataSource}
            onChange={(value) =>
              onChange({
                ...query,
                linkedQuery: { ...value, refId: 'linked' },
              })
            }
            onRunQuery={onRunQuery}
            query={query.linkedQuery ?? ({ refId: 'linked' } as any)}
            history={[]}
          />
        </>
      )}
      {query.queryType === 'lokiSearch' && !lokiDataSource && (
        <div className="text-warning">Please set up a Traces-to-logs datasource in the datasource settings.</div>
      )}
      {query.queryType === 'search' && (
        <>
          <InlineFieldRow>
            <InlineField label="Query" labelWidth={21} grow>
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
                cleanText={cleanText}
                onRunQuery={onRunQuery}
                syntaxLoaded={syntaxLoaded}
                portalOrigin="tempo"
              />
            </InlineField>
          </InlineFieldRow>
          <div className={css({ width: '50%' })}>
            <AdvancedOptions query={query} onChange={onChange} />
          </div>
        </>
      )}
      {(query.queryType === 'traceId' || !query.queryType) && (
        <LegacyForms.FormField
          label="Trace ID"
          labelWidth={4}
          inputEl={
            <div className="slate-query-field__wrapper">
              <div className="slate-query-field" aria-label={selectors.components.QueryField.container}>
                <input
                  style={{ width: '100%' }}
                  value={query.query || ''}
                  onChange={(e) =>
                    onChange({
                      ...query,
                      query: e.currentTarget.value,
                      queryType: 'traceId',
                    })
                  }
                />
              </div>
            </div>
          }
        />
      )}
    </>
  );
}
