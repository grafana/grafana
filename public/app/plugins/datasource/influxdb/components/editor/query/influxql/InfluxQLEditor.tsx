import { css } from '@emotion/css';
import React from 'react';

import InfluxDatasource from '../../../../datasource';
import { buildRawQuery } from '../../../../queryUtils';
import { InfluxQuery } from '../../../../types';

import { QueryEditorModeSwitcher } from './QueryEditorModeSwitcher';
import { RawInfluxQLEditor } from './code/RawInfluxQLEditor';
import { VisualInfluxQLEditor } from './visual/VisualInfluxQLEditor';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const InfluxQlEditor = ({ datasource, query, onRunQuery, onChange }: Props) => {
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
