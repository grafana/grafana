import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { EditorField, EditorRow, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../../datasource';
import SQLGenerator from '../../../../language/cloudwatch-sql/SQLGenerator';
import { CloudWatchMetricsQuery } from '../../../../types';

import SQLBuilderSelectRow from './SQLBuilderSelectRow';
import SQLFilter from './SQLFilter';
import SQLGroupBy from './SQLGroupBy';
import SQLOrderByGroup from './SQLOrderByGroup';
import { setSql } from './utils';

export type Props = {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  onChange: (value: CloudWatchMetricsQuery) => void;
};

export const SQLBuilderEditor = ({ query, datasource, onChange }: React.PropsWithChildren<Props>) => {
  const sql = query.sql ?? {};

  const onQueryChange = useCallback(
    (query: CloudWatchMetricsQuery) => {
      const sqlGenerator = new SQLGenerator();
      const sqlString = sqlGenerator.expressionToSqlQuery(query.sql ?? {}, query.accountId);
      const fullQuery = {
        ...query,
        sqlExpression: sqlString,
      };

      onChange(fullQuery);
    },
    [onChange]
  );

  const [sqlPreview, setSQLPreview] = useState<string | undefined>();
  useEffect(() => {
    const sqlGenerator = new SQLGenerator();
    const sqlString = sqlGenerator.expressionToSqlQuery(query.sql ?? {}, query.accountId);
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
};
