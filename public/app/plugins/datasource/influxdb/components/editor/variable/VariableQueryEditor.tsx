import React from 'react';

import { QueryEditorProps } from '@grafana/data';
import { Field, FieldSet, InlineFieldRow, TextArea } from '@grafana/ui';
import { InlineField } from '@grafana/ui/';

import InfluxDatasource from '../../../datasource';
import { InfluxOptions, InfluxQuery, InfluxVariableQuery, InfluxVersion } from '../../../types';
import { FluxQueryEditor } from '../query/flux/FluxQueryEditor';

export type Props = QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions, InfluxVariableQuery>;

const refId = 'InfluxVariableQueryEditor-VariableQuery';

const useVariableQuery = (query: InfluxVariableQuery | string): InfluxVariableQuery => {
  // in legacy variable support query can be only a string
  // in new variable support query can be an object and hold more information
  // to be able to support old version we check the query here
  if (typeof query === 'string') {
    return {
      refId,
      query,
    };
  } else {
    return {
      refId,
      query: query.query ?? '',
    };
  }
};

export const InfluxVariableEditor = ({ onChange, datasource, query }: Props) => {
  const varQuery = useVariableQuery(query);

  const onChangeHandler = (q: InfluxQuery) => {
    onChange({ refId, query: q.query || '' });
  };

  const onBlurHandler = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    onChange({ refId, query: e.currentTarget.value });
  };

  switch (datasource.version) {
    case InfluxVersion.Flux:
      return <FluxQueryEditor datasource={datasource} query={varQuery} onChange={onChangeHandler} />;
    case InfluxVersion.SQL:
      return (
        <FieldSet>
          <Field htmlFor="influx-sql-variable-query">
            <TextArea
              id="influx-sql-variable-query"
              defaultValue={varQuery.query || ''}
              placeholder="metric name or tags query"
              rows={1}
              onBlur={onBlurHandler}
            />
          </Field>
        </FieldSet>
      );
    case InfluxVersion.InfluxQL:
    default:
      return (
        <InlineFieldRow>
          <InlineField label="Query" labelWidth={20} required grow aria-labelledby="label-select">
            <TextArea
              defaultValue={varQuery.query || ''}
              placeholder="metric name or tags query"
              rows={1}
              onBlur={onBlurHandler}
            />
          </InlineField>
        </InlineFieldRow>
      );
  }
};
