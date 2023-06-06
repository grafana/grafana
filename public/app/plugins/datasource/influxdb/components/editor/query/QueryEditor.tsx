import { css } from '@emotion/css';
import React from 'react';

import { QueryEditorProps } from '@grafana/data/src';

import InfluxDatasource from '../../../datasource';
import { buildRawQuery } from '../../../queryUtils';
import { InfluxOptions, InfluxQuery } from '../../../types';

import { FluxQueryEditor } from './flux/FluxQueryEditor';
import { QueryEditorModeSwitcher } from './influxql/QueryEditorModeSwitcher';
import { RawInfluxQLEditor } from './influxql/code/RawInfluxQLEditor';
import { VisualInfluxQLEditor as VisualInfluxQLEditor } from './influxql/visual/VisualInfluxQLEditor';

type Props = QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions>;

export const QueryEditor = ({ query, onChange, onRunQuery, datasource }: Props) => {
  if (datasource.isFlux) {
    return (
      <div className="gf-form-query-content">
        <FluxQueryEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />
      </div>
    );
  }

  return (
    <div className={css({ display: 'flex' })}>
      <div className={css({ flexGrow: 1 })}>
        {query.rawQuery ? (
          <RawInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} />
        ) : (
          <VisualInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />
        )}
      </div>
      <QueryEditorModeSwitcher
        isRaw={query.rawQuery ?? false}
        onChange={(value) => {
          onChange({ ...query, query: buildRawQuery(query), rawQuery: value });
          onRunQuery();
        }}
      />
    </div>
  );
};
