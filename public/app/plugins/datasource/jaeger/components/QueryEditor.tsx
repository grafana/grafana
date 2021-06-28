import { css } from '@emotion/css';
import { QueryEditorProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, Input, RadioButtonGroup } from '@grafana/ui';
import React from 'react';
import { JaegerDatasource } from '../datasource';
import { JaegerQuery, JaegerQueryType } from '../types';
import { SearchForm } from './SearchForm';

type Props = QueryEditorProps<JaegerDatasource, JaegerQuery>;

export function QueryEditor({ datasource, query, onChange }: Props) {
  return (
    <div className={css({ width: '50%' })}>
      <InlineFieldRow>
        <InlineField label="Query type">
          <RadioButtonGroup<JaegerQueryType>
            options={[
              { value: 'search', label: 'Search' },
              { value: undefined, label: 'TraceID' },
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
      {query.queryType === 'search' ? (
        <SearchForm datasource={datasource} query={query} onChange={onChange} />
      ) : (
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
      )}
    </div>
  );
}
