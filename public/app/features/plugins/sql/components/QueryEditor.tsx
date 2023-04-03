import React, { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { QueryEditorProps } from '@grafana/data';
import { EditorMode, Space } from '@grafana/experimental';

import { SqlDatasource } from '../datasource/SqlDatasource';
import { applyQueryDefaults } from '../defaults';
import { SQLQuery, QueryRowFilter, SQLOptions } from '../types';
import { haveColumns } from '../utils/sql.utils';

import { QueryHeader, QueryHeaderProps } from './QueryHeader';
import { RawEditor } from './query-editor-raw/RawEditor';
import { VisualEditor } from './visual-query-builder/VisualEditor';

interface Props extends QueryEditorProps<SqlDatasource, SQLQuery, SQLOptions> {
  queryHeaderProps?: Pick<QueryHeaderProps, 'isDatasetSelectorHidden'>;
}

export function SqlQueryEditor({ datasource, query, onChange, onRunQuery, range, queryHeaderProps }: Props) {
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

  /* 
    The behavior of the dataset (database) selector is based on whether the user chose to create a datasource
    with or without a default database. If the user configured a default database, the dataset (database) selector
    should be disabled, and defacto assigned the value of the configured default database. If the user chose to
    NOT assign a default database, then the user should be able to use the <DatasetSelector /> within the panel query editor
    to chose between multiple databases within the datasource.
    
    This checks to see whether 1) there is indeed a default database (preconfiguredDataset), and also 2) whether the user
    added a default database where there wasn't one before. Both scenarios would require an update the the query state.
  */
  if (!!preconfiguredDatabase && query.dataset !== preconfiguredDatabase) {
    onChange({ ...query, dataset: preconfiguredDatabase });
  }

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
