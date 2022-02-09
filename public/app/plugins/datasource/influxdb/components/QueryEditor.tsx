import React from 'react';
import { css } from '@emotion/css';
import { QueryEditorProps } from '@grafana/data';
import { InfluxOptions, InfluxQuery } from '../types';
import InfluxDatasource from '../datasource';
import { FluxQueryEditor } from './FluxQueryEditor';
import { RawInfluxQLEditor } from './RawInfluxQLEditor';
import { Editor as VisualInfluxQLEditor } from './VisualInfluxQLEditor/Editor';
import { QueryEditorModeSwitcher } from './QueryEditorModeSwitcher';
import { buildRawQuery } from '../queryUtils';

type Props = QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions>;

export const QueryEditor = ({ query, onChange, onRunQuery, datasource, range, data }: Props): JSX.Element => {
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
