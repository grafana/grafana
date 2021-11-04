import React, { useCallback, useEffect, useState } from 'react';
import { CloudWatchMetricsQuery } from '../../types';
import { CloudWatchDatasource } from '../../datasource';
import EditorRow from '../ui/EditorRow';
import EditorRows from '../ui/EditorRows';
import EditorField from '../ui/EditorField';
import SQLFilter from './SQLFilter';
import SQLGroupBy from './SQLGroupBy';
import SQLBuilderSelectRow from './SQLBuilderSelectRow';
import SQLGenerator from '../../cloudwatch-sql/SQLGenerator';
import SQLOrderByGroup from './SQLOrderByGroup';
import { Input } from '@grafana/ui';
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
