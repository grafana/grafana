import React, { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { QueryEditorProps } from '@grafana/data';
import { EditorMode, Space } from '@grafana/experimental';
import { Alert } from '@grafana/ui';

import { SqlDatasource } from '../datasource/SqlDatasource';
import { applyQueryDefaults } from '../defaults';
import { SQLQuery, QueryRowFilter, SQLOptions } from '../types';
import { haveColumns } from '../utils/sql.utils';

import { QueryHeader, QueryHeaderProps } from './QueryHeader';
import { RawEditor } from './query-editor-raw/RawEditor';
import { VisualEditor } from './visual-query-builder/VisualEditor';

export interface SqlQueryEditorProps extends QueryEditorProps<SqlDatasource, SQLQuery, SQLOptions> {
  queryHeaderProps?: Pick<QueryHeaderProps, 'disableDatasetSelector'>;
}

export function SqlQueryEditor({
  datasource,
  query,
  onChange,
  onRunQuery,
  range,
  queryHeaderProps,
}: SqlQueryEditorProps) {
  const [hasDatabaseConfigIssue, setHasDatabaseConfigIssue] = useState<boolean>(false);
  const [hasNoPostgresDefaultDatabaseConfig, setHasNoPostgresDefaultDatabaseConfig] = useState<boolean>(false);

  const [isQueryRunnable, setIsQueryRunnable] = useState(true);
  const db = datasource.getDB();

  const { preconfiguredDatabase } = datasource;
  const { loading, error } = useAsync(async () => {
    return () => {
      if (datasource.getDB(datasource.id).init !== undefined) {
        datasource.getDB(datasource.id).init!();
      }
    };
  }, [datasource]);

  useEffect(() => {
    // This checks to see whether there is indeed a default database (preconfiguredDataset), and if so,
    // if that default database is different than they currently-chosen one. Both scenarios require a possible alert.
    if (!!preconfiguredDatabase && query.dataset !== preconfiguredDatabase) {
      setHasDatabaseConfigIssue(true);
    }

    // This tests if the Postgres datacource was configured with a default database or not.
    if (queryHeaderProps?.disableDatasetSelector) {
      setHasNoPostgresDefaultDatabaseConfig(true);
    }
  }, [preconfiguredDatabase, query, onChange, queryHeaderProps]);

  const queryWithDefaults = applyQueryDefaults(query);
  const [queryRowFilter, setQueryRowFilter] = useState<QueryRowFilter>({
    filter: !!queryWithDefaults.sql?.whereString,
    group: !!queryWithDefaults.sql?.groupBy?.[0]?.property.name,
    order: !!queryWithDefaults.sql?.orderBy?.property.name,
    preview: true,
  });
  const [queryToValidate, setQueryToValidate] = useState(queryWithDefaults);

  useEffect(() => {
    return () => {
      if (datasource.getDB(datasource.id).dispose !== undefined) {
        datasource.getDB(datasource.id).dispose!();
      }
    };
  }, [datasource]);

  const processQuery = useCallback(
    (q: SQLQuery) => {
      if (isQueryValid(q) && onRunQuery) {
        onRunQuery();
      }
    },
    [onRunQuery]
  );

  const onQueryChange = (q: SQLQuery, process = true) => {
    setQueryToValidate(q);
    onChange(q);

    if (haveColumns(q.sql?.columns) && q.sql?.columns.some((c) => c.name) && !queryRowFilter.group) {
      setQueryRowFilter({ ...queryRowFilter, group: true });
    }

    if (process) {
      processQuery(q);
    }
  };

  const onQueryHeaderChange = (q: SQLQuery) => {
    setQueryToValidate(q);
    onChange(q);
  };

  if (loading || error) {
    return null;
  }

  return (
    <>
      {hasDatabaseConfigIssue && (
        <Alert
          data-testid="database_update"
          severity="warning"
          title="Default datasource configuration"
          elevated={true}
          onRemove={() => {
            // Remove the warning, and reset state with the new database.
            setHasDatabaseConfigIssue(false);
            onChange({ ...query, dataset: preconfiguredDatabase });
          }}
          buttonContent="FINISHED"
        >
          Your default database configuration has been changed or updated. Make note of the query you have built before
          clicking FINISHED. Clicking FINISHED will update your query parameters with the new database data.
        </Alert>
      )}
      {hasNoPostgresDefaultDatabaseConfig && (
        <Alert
          data-testid="no_postgres_database"
          severity="warning"
          title="Default datasource configuration"
          elevated={true}
          onRemove={() => setHasNoPostgresDefaultDatabaseConfig(false)}
        >
          You do not currenlty have a database configured for this datasource. Please configure a default database
          first.
        </Alert>
      )}
      <QueryHeader
        db={db}
        preconfiguredDataset={preconfiguredDatabase}
        onChange={onQueryHeaderChange}
        onRunQuery={onRunQuery}
        onQueryRowChange={setQueryRowFilter}
        queryRowFilter={queryRowFilter}
        query={queryWithDefaults}
        isQueryRunnable={isQueryRunnable}
        {...queryHeaderProps}
      />

      <Space v={0.5} />

      {queryWithDefaults.editorMode !== EditorMode.Code && (
        <VisualEditor
          db={db}
          query={queryWithDefaults}
          onChange={(q: SQLQuery) => onQueryChange(q, false)}
          queryRowFilter={queryRowFilter}
          onValidate={setIsQueryRunnable}
          range={range}
        />
      )}

      {queryWithDefaults.editorMode === EditorMode.Code && (
        <RawEditor
          db={db}
          query={queryWithDefaults}
          queryToValidate={queryToValidate}
          onChange={onQueryChange}
          onRunQuery={onRunQuery}
          onValidate={setIsQueryRunnable}
          range={range}
        />
      )}
    </>
  );
}

const isQueryValid = (q: SQLQuery) => {
  return Boolean(q.rawSql);
};
