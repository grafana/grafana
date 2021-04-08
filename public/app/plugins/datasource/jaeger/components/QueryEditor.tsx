import { QueryEditorProps } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, RadioButtonGroup } from '@grafana/ui';
import React, { useEffect } from 'react';
import { JaegerDatasource } from '../datasource';
import { JaegerQuery, JaegerQueryType } from '../types';
import { SearchForm } from './SearchForm';

type Props = QueryEditorProps<JaegerDatasource, JaegerQuery>;

export function QueryEditor({ datasource, query, onChange }: Props) {
  useEffect(() => {
    if (!query.queryType) {
      onChange({
        ...query,
        queryType: 'search',
      });
    }
  }, [onChange, query]);

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Query type">
          <RadioButtonGroup<JaegerQueryType>
            options={[
              { value: 'search', label: 'Search' },
              { value: 'traceID', label: 'TraceID' },
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
      {!query.queryType || query.queryType === 'search' ? (
        <SearchForm datasource={datasource} query={query} onChange={onChange} />
      ) : (
        <InlineFieldRow>
          <InlineField label="Trace ID">
            <Input
              value={query.traceID}
              onChange={(v) =>
                onChange({
                  ...query,
                  traceID: v.currentTarget.value,
                })
              }
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
}
