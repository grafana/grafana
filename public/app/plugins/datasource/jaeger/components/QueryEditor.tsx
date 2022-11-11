import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { FileDropzone, InlineField, InlineFieldRow, QueryField, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { JaegerDatasource } from '../datasource';
import { JaegerQuery, JaegerQueryType } from '../types';

import { SearchForm } from './SearchForm';

type Props = QueryEditorProps<JaegerDatasource, JaegerQuery>;

export function QueryEditor({ datasource, query, onChange, onRunQuery }: Props) {
  const styles = useStyles2(getStyles);

  const onChangeQuery = (value: string) => {
    const nextQuery: JaegerQuery = { ...query, query: value };
    onChange(nextQuery);
  };

  const renderEditorBody = () => {
    switch (query.queryType) {
      case 'search':
        return <SearchForm datasource={datasource} query={query} onChange={onChange} />;
      case 'upload':
        return (
          <div className={styles.fileDropzoneContainer}>
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
            <InlineField label="Trace ID" labelWidth={14} grow>
              <QueryField
                query={query.query}
                onChange={onChangeQuery}
                onRunQuery={onRunQuery}
                onBlur={() => {}}
                placeholder={'Enter a Trace ID (run with Shift+Enter)'}
                portalOrigin="jaeger"
              />
            </InlineField>
          </InlineFieldRow>
        );
    }
  };

  return (
    <>
      <div className={styles.container}>
        <InlineFieldRow>
          <InlineField label="Query type">
            <RadioButtonGroup<JaegerQueryType>
              options={[
                { value: 'search', label: 'Search' },
                { value: undefined, label: 'TraceID' },
                { value: 'upload', label: 'JSON File' },
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

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    width: 100%;
  `,
  fileDropzoneContainer: css`
    padding: ${theme.spacing(2)};
  `,
});
