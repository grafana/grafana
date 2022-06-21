import React, { useCallback, useEffect, useState } from 'react';

import { EditorField, EditorRow, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import SQLGenerator from '../../cloudwatch-sql/SQLGenerator';
import { CloudWatchDatasource } from '../../datasource';
import { CloudWatchMetricsQuery } from '../../types';

import SQLBuilderSelectRow from './SQLBuilderSelectRow';
import SQLFilter from './SQLFilter';
import SQLGroupBy from './SQLGroupBy';
import SQLOrderByGroup from './SQLOrderByGroup';
import { setSql } from './utils';

export type Props = {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  onChange: (value: CloudWatchMetricsQuery) => void;
  onRunQuery: () => void;
};

export function SQLBuilderEditor({ query, datasource, onChange, onRunQuery }: React.PropsWithChildren<Props>) {
  const sql = query.sql ?? {};

  const onQueryChange = useCallback(
    (query: CloudWatchMetricsQuery) => {
      const sqlGenerator = new SQLGenerator();
      const sqlString = sqlGenerator.expressionToSqlQuery(query.sql ?? {});
      const fullQuery = {
        ...query,
        sqlExpression: sqlString,
      };

      onChange(fullQuery);
      onRunQuery();
    },
    [onChange, onRunQuery]
  );

  const [sqlPreview, setSQLPreview] = useState<string | undefined>();
  useEffect(() => {
    const sqlGenerator = new SQLGenerator();
    const sqlString = sqlGenerator.expressionToSqlQuery(query.sql ?? {});
    if (sqlPreview !== sqlString) {
      setSQLPreview(sqlString);
    }
  }, [query, sqlPreview, setSQLPreview]);

  return (
    <EditorRows>
      <EditorRow>
        <SQLBuilderSelectRow query={query} onQueryChange={onQueryChange} datasource={datasource} />
      </EditorRow>

      <EditorRow>
        <EditorField label="Filter" optional={true}>
          <SQLFilter query={query} onQueryChange={onQueryChange} datasource={datasource} />
        </EditorField>
      </EditorRow>

      <EditorRow>
        <EditorField label="Group by" optional>
          <SQLGroupBy query={query} onQueryChange={onQueryChange} datasource={datasource} />
        </EditorField>

        <SQLOrderByGroup query={query} onQueryChange={onQueryChange} datasource={datasource}></SQLOrderByGroup>

        <EditorField label="Limit" optional>
          <Input
            id={`${query.refId}-cloudwatch-sql-builder-editor-limit`}
            value={sql.limit}
            onChange={(e) => {
              const val = e.currentTarget.valueAsNumber;
              onQueryChange(setSql(query, { limit: isNaN(val) ? undefined : val }));
            }}
            type="number"
            min={1}
          />
        </EditorField>
      </EditorRow>

      {sqlPreview && (
        <EditorRow>
          {process.env.NODE_ENV === 'development' && <pre>{JSON.stringify(query.sql ?? {}, null, 2)}</pre>}
          <pre>{sqlPreview ?? ''}</pre>
        </EditorRow>
      )}
    </EditorRows>
  );
}
