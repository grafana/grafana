import { QueryEditorProps } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, TextArea } from '@grafana/ui';

import InfluxDatasource from '../../../datasource';
import { InfluxOptions, InfluxQuery, InfluxVariableQuery, InfluxVersion } from '../../../types';
import { FluxQueryEditor } from '../query/flux/FluxQueryEditor';

type Props = QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions, InfluxVariableQuery>;

const refId = 'InfluxVariableQueryEditor-VariableQuery';

export const InfluxVariableEditor = ({ onChange, datasource, query }: Props) => {
  const getVariableQuery = (q: InfluxVariableQuery | string) => {
    // in legacy variable support query can be only a string
    // in new variable support query can be an object and hold more information
    // to be able to support old version we check the query here
    if (typeof q !== 'string') {
      return q;
    }

    return {
      refId,
      query: q,
      ...(datasource.version === InfluxVersion.Flux ? { maxDataPoints: 1000 } : {}),
    };
  };

  switch (datasource.version) {
    case InfluxVersion.Flux:
      return (
        <>
          <FluxQueryEditor
            datasource={datasource}
            query={getVariableQuery(query)}
            onChange={(q) => {
              onChange({ ...query, query: q.query ?? '' });
            }}
          />
          <InlineFieldRow>
            <InlineField
              label="Max Data Points"
              labelWidth={20}
              required
              grow
              aria-labelledby="flux-maxdatapoints"
              tooltip={<div>Upper boundary of data points will return for the variable query.</div>}
            >
              <Input
                id="influx-sql-variable-maxdatapoints"
                aria-label="flux-maxdatapoints"
                type="number"
                defaultValue={query.maxDataPoints ?? 1000}
                placeholder="Default is 1000"
                onBlur={(e) => {
                  onChange({
                    refId,
                    query: query.query,
                    maxDataPoints: Number.parseInt(e.currentTarget.value, 10),
                  });
                }}
              />
            </InlineField>
          </InlineFieldRow>
        </>
      );
    default:
      return (
        <InlineFieldRow>
          <InlineField label="Query" labelWidth={20} required grow aria-labelledby="influx-variable-query">
            <TextArea
              aria-label="influx-variable-query"
              defaultValue={getVariableQuery(query).query}
              placeholder="metric name or tags query"
              rows={1}
              onBlur={(e) => {
                onChange({ refId, query: e.currentTarget.value ?? '' });
              }}
            />
          </InlineField>
        </InlineFieldRow>
      );
  }
};
