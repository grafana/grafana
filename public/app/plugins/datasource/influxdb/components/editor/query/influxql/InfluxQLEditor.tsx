import { css } from '@emotion/css';
import React from 'react';

import InfluxDatasource from '../../../../datasource';
import { buildRawQuery } from '../../../../queryUtils';
import { InfluxQuery } from '../../../../types';

import { QueryEditorModeSwitcher } from './QueryEditorModeSwitcher';
import { RawInfluxQLEditor } from './code/RawInfluxQLEditor';
import { VisualInfluxQLMigratedEditor } from './visual/backend-driven/VisualInfluxQLMigratedEditor';
import { VisualInfluxQLEditor } from './visual/frontend-driven/VisualInfluxQLEditor';

type Props = {
  backendMigration: boolean;
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const InfluxQlEditor = ({ backendMigration, datasource, query, onRunQuery, onChange }: Props) => {
  return (
    <div className={css({ display: 'flex' })}>
      <div className={css({ flexGrow: 1 })}>
        {query.rawQuery ? (
          <RawInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} />
        ) : (
          <>
            {backendMigration ? (
              <VisualInfluxQLMigratedEditor
                query={query}
                onChange={onChange}
                onRunQuery={onRunQuery}
                datasource={datasource}
              />
            ) : (
              <VisualInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />
            )}
          </>
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
