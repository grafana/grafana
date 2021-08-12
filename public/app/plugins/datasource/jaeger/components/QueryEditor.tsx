import { css } from '@emotion/css';
import { QueryEditorProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FileDropzone, InlineField, InlineFieldRow, Input, RadioButtonGroup, useTheme2 } from '@grafana/ui';
import React from 'react';
import { JaegerDatasource } from '../datasource';
import { JaegerQuery, JaegerQueryType } from '../types';
import { SearchForm } from './SearchForm';

type Props = QueryEditorProps<JaegerDatasource, JaegerQuery>;

export function QueryEditor({ datasource, query, onChange, onRunQuery }: Props) {
  const theme = useTheme2();

  const renderEditorBody = () => {
    switch (query.queryType) {
      case 'search':
        return <SearchForm datasource={datasource} query={query} onChange={onChange} />;
      case 'upload':
        return (
          <div className={css({ padding: theme.spacing(2) })}>
            <FileDropzone
              options={{ multiple: false }}
              onLoad={(result) => {
                datasource.uploadedJson = result;
                onRunQuery();
              }}
            />
          </div>
        );
      default:
        return (
          <InlineFieldRow>
            <InlineField label="Trace ID" labelWidth={21} grow>
              <Input
                aria-label={selectors.components.DataSource.Jaeger.traceIDInput}
                placeholder="Eg. 4050b8060d659e52"
                value={query.query || ''}
                onChange={(v) =>
                  onChange({
                    ...query,
                    query: v.currentTarget.value,
                  })
                }
              />
            </InlineField>
          </InlineFieldRow>
        );
    }
  };

  return (
    <>
      <div className={css({ width: query.queryType === 'upload' ? '100%' : '50%' })}>
        <InlineFieldRow>
          <InlineField label="Query type">
            <RadioButtonGroup<JaegerQueryType>
              options={[
                { value: 'search', label: 'Search' },
                { value: undefined, label: 'TraceID' },
                { value: 'upload', label: 'JSON file' },
              ]}
              value={query.queryType}
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
        {renderEditorBody()}
      </div>
    </>
  );
}
