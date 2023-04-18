import React, { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { QueryEditorProps } from '@grafana/data';
import { EditorMode, Space } from '@grafana/experimental';
import { config } from '@grafana/runtime';
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
  console.log(query, 'query');
  const sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled = !!config.featureToggles.sqlDatasourceDatabaseSelection;

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
    if (sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled) {
      /*
      This checks if
      1) there is a preconfigured database (freshly created MSSQL/MYSQL datasources may or may not have a preconfigured database)?
      2) there is a previously-chosen database from the DatasetSelector (freshly created datasources will NOT have a previously-chosen database,
        and we don't want this alert to be displayed on all newly created datasources)?
        Iff yes to both,
        3) is that preconfigured database different than they previously-chosen one?
        If so, display the alert.
        */
      if (!!preconfiguredDatabase && !!query.dataset && query.dataset !== preconfiguredDatabase) {
        setHasDatabaseConfigIssue(true);
      }

      // This tests the Postgres datasource - all Postgres datasources are passed a default prop of `disableDatasetSelector`.
      // 1) Is it indeed a Posgres datasource, and 2) is it configured with a default database? If os, then display appropriate alert.
      if (queryHeaderProps?.disableDatasetSelector && !preconfiguredDatabase) {
        setHasNoPostgresDefaultDatabaseConfig(true);
      }
    }
  }, [preconfiguredDatabase, query, onChange, queryHeaderProps, sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled]);

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

  const resetQuery = () => {
    const updatedQuery = {
      ...query,
      dataset: preconfiguredDatabase,
      table: undefined,
      sql: undefined,
      rawSql: '',
    };
    onChange(updatedQuery);
    // onRunQuery();
  };

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
          severity="warning"
          title="Default datasource update"
          elevated={true}
          onRemove={() => {
            // Remove the warning, and reset state with the new database.
            setHasDatabaseConfigIssue(false);
            resetQuery();
          }}
          buttonContent="Update Query"
        >
          <span>
            Your default database configuration has been changed or updated. The previous database is no longer
            available. Make note of the query you have built before clicking <code>Update Query.</code>
            Clicking <code>Update Query</code> will clear your previous query parameters.
          </span>
        </Alert>
      )}

      {hasNoPostgresDefaultDatabaseConfig && (
        <Alert severity="error" title="Default datasource error" elevated={true}>
          You do not currently have a default database configured for this data source. Please configure one through the
          Data Sources Configuration page, or if you are using a provisioned data source, update you configuration file
          with a default database name.
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
        cascadeDisable={hasDatabaseConfigIssue || hasNoPostgresDefaultDatabaseConfig}
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
