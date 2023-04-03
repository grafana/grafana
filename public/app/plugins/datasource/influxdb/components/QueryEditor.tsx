import { css } from '@emotion/css';
import React from 'react';

import { QueryEditorProps } from '@grafana/data';

import InfluxDatasource from '../datasource';
import { buildRawQuery } from '../queryUtils';
import { InfluxOptions, InfluxQuery } from '../types';

import { FluxQueryEditor } from './FluxQueryEditor';
import { QueryEditorModeSwitcher } from './QueryEditorModeSwitcher';
import { RawInfluxQLEditor } from './RawInfluxQLEditor';
import { Editor as VisualInfluxQLEditor } from './VisualInfluxQLEditor/Editor';

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
          onChange({ ...query, expr: buildRawQuery(query), rawQuery: value });
          onRunQuery();
        }}
      />
    </div>
  );
};
