import { css } from '@emotion/css';
import React from 'react';

import InfluxDatasource from '../../../../../datasource';
import { buildRawQuery } from '../../../../../queryUtils';
import { InfluxQuery } from '../../../../../types';
import { QueryEditorModeSwitcher } from '../QueryEditorModeSwitcher';

import { RawInfluxQLMigratedEditor } from './RawInfluxQLMigratedEditor';
import { VisualInfluxQLMigratedEditor } from './VisualInfluxQLMigratedEditor';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const InfluxQlMigratedEditor = ({ datasource, query, onRunQuery, onChange }: Props) => {
  return (
    <div className={css({ display: 'flex' })}>
      <div className={css({ flexGrow: 1 })}>
        {query.rawQuery ? (
          <RawInfluxQLMigratedEditor
            datasource={datasource}
            query={query}
            onChange={onChange}
            onRunQuery={onRunQuery}
          />
        ) : (
          <VisualInfluxQLMigratedEditor
            datasource={datasource}
            query={query}
            onChange={onChange}
            onRunQuery={onRunQuery}
          />
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
