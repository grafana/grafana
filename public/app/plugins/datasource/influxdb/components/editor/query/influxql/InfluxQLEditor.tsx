import { css } from '@emotion/css';
import React from 'react';

import InfluxDatasource from '../../../../datasource';
import { buildRawQuery } from '../../../../queryUtils';
import { InfluxQuery } from '../../../../types';

import { QueryEditorModeSwitcher } from './QueryEditorModeSwitcher';
import { InfluxQlMigratedEditor } from './backend-driven/InfluxQlMigratedEditor';
import { RawInfluxQLEditor } from './frontend-driven/RawInfluxQLEditor';
import { VisualInfluxQLEditor } from './frontend-driven/VisualInfluxQLEditor/VisualInfluxQLEditor';

type Props = {
  backendMigration: boolean;
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const InfluxQlEditor = ({ backendMigration, datasource, query, onRunQuery, onChange }: Props) => {
  return backendMigration ? (
    <InfluxQlMigratedEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />
  ) : (
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
