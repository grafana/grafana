import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { ColumnDefinition, SQLEditor, TableDefinition } from '@grafana/experimental';

import { SQLQuery, TableSchema } from '../../types';
import { formatSQL } from '../../utils/formatSQL';

import { getSqlCompletionProvider } from './sqlCompletionProvider';

type Props = {
  query: SQLQuery;
  getTables: (d?: string) => Promise<TableDefinition[]>;
  getColumns: (q: SQLQuery) => Promise<ColumnDefinition[]>;
  getTableSchema: (path: string) => Promise<TableSchema | null>;
  onChange: (value: SQLQuery, processQuery: boolean) => void;
  children?: (props: { formatQuery: () => void }) => React.ReactNode;
  width?: number;
  height?: number;
  // completionProvider: () => Promise<any>;
};

export function QueryEditorRaw({
  children,
  getColumns: apiGetColumns,
  getTables: apiGetTables,
  getTableSchema: apiGetTableSchema,
  onChange,
  query,
  width,
  height,
}: Props) {
  const getColumns = useRef<Props['getColumns']>(apiGetColumns);
  const getTables = useRef<Props['getTables']>(apiGetTables);
  const getTableSchema = useRef<Props['getTableSchema']>(apiGetTableSchema);

  const completionProvider = useMemo(() => getSqlCompletionProvider({ getColumns, getTables, getTableSchema }), []);

  // We need to pass query via ref to SQLEditor as onChange is executed via monacoEditor.onDidChangeModelContent callback, not onChange property
  const queryRef = useRef<SQLQuery>(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    getColumns.current = apiGetColumns;
    getTables.current = apiGetTables;
  }, [apiGetColumns, apiGetTables]);

  const onRawQueryChange = useCallback(
    (rawSql: string, processQuery: boolean) => {
      const newQuery = {
        ...queryRef.current,
        rawQuery: true,
        rawSql,
      };
      onChange(newQuery, processQuery);
    },
    [onChange]
  );

  return (
    <SQLEditor
      width={width}
      height={height}
      query={query.rawSql}
      onChange={onRawQueryChange}
      language={{ id: 'sql', completionProvider, formatter: formatSQL }}
    >
      {children}
    </SQLEditor>
  );
}
