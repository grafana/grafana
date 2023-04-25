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
  queryHeaderProps?: Pick<QueryHeaderProps, 'isPostgresInstance'>;
}

export function SqlQueryEditor({
  datasource,
  query,
  onChange,
  onRunQuery,
  range,
  queryHeaderProps,
}: SqlQueryEditorProps) {
  // console.log('🚀 ~ file: QueryEditor.tsx:30 ~ query:', query);
  // console.log('🚀 ~ file: QueryEditor.tsx:30 ~ datasource:', datasource);
  const sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled = !!config.featureToggles.sqlDatasourceDatabaseSelection;

  const [hasDatabaseConfigIssue, setHasDatabaseConfigIssue] = useState<boolean>(false);
  const [hasNoPostgresDefaultDatabaseConfig, setHasNoPostgresDefaultDatabaseConfig] = useState<boolean>(false);

  const [isQueryRunnable, setIsQueryRunnable] = useState(true);
  const db = datasource.getDB();

  const { preconfiguredDatabase } = datasource;
  const isPostgresInstance = !!queryHeaderProps?.isPostgresInstance;
  const { loading, error } = useAsync(async () => {
    return () => {
      if (datasource.getDB(datasource.id).init !== undefined) {
        datasource.getDB(datasource.id).init!();
      }
    };
  }, [datasource]);

  useEffect(() => {
    if (sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled) {
      // JEV: possible issues:
      // - Updating a datasource config DOES NOT effect the query run for MYSQL/MSSQL data sources when loading a dashboard,
      //   it is saved in the json model (jsondata), but the query is NOT updated. So, the change is NOT reflected upon panel load,
      //   since the panel uses the query object to make the query.
      // - If a default database changes for ANY data source, and the new database has a table that the previous one also had,
      //   the query will NOT error out, but WILL be caught by my alerts
      // - Unable to find a way to bubble editor-level errors to panel chrome
      // - What queries are being run on dashboard load???
      /*
        If there is a preconfigured database (either through the provisioning config, or the data source configuration component),
        AND there is also a previously-chosen dataset via the dataset selector dropdown, AND those 2 values DON'T match,
        that means either 1) the preconfigured database changed/updated (updated either through provisioning or the GUI),
        OR 2) there WASN'T a preconfigred database before, but there IS now (updated either through provisioning or the GUI).
        In either case, we need to throw a warning to alert the user that something has changed.
      */
      if (!!preconfiguredDatabase && !!query.dataset && query.dataset !== preconfiguredDatabase) {
        setHasDatabaseConfigIssue(true);
      }

      /*
        If the data source is Postgres (all Postgres data source query editors are passed a default prop of `isPostgresInstance`),
        then test for a preconfigured database (either through provisioning or the GUI). Postgres REQUIRES a default database,
        so throw the appropriate warning.
      */
      if (isPostgresInstance && !preconfiguredDatabase) {
        setHasNoPostgresDefaultDatabaseConfig(true);
      }
    }
  }, [
    datasource,
    isPostgresInstance,
    preconfiguredDatabase,
    query,
    sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled,
  ]);

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

  const resetQuery = () => {
    const updatedQuery = {
      ...query,
      dataset: preconfiguredDatabase,
      table: undefined,
      sql: undefined,
      rawSql: '',
    };
    onChange(updatedQuery);
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
            Your default database configuration has been modified. The previous database {<code>{query.dataset}</code>}{' '}
            is no longer available, and has been updated to {<code>{preconfiguredDatabase}</code>}. Make note of the
            query you have built before clicking <code>Update Query.</code> Clicking <code>Update Query</code> will
            clear your previous query parameters.
          </span>
        </Alert>
      )}

      {hasNoPostgresDefaultDatabaseConfig && (
        <Alert severity="error" title="Default datasource error" elevated={true}>
          You do not currently have a default database configured for this data source. Postgres requires a default
          database with which to connect. Please configure one through the Data Sources Configuration page, or if you
          are using a provisioned data source, update you configuration file with a default database name.
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
        isPostgresInstance={isPostgresInstance}
        hasConfigIssue={hasDatabaseConfigIssue || hasNoPostgresDefaultDatabaseConfig}
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
