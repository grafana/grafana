import React, { useCallback, useEffect, useRef } from 'react';

import { SQLEditor } from '@grafana/experimental';

import { LanguageCompletionProvider, SQLQuery } from '../../types';
import { formatSQL } from '../../utils/formatSQL';

type Props = {
  query: SQLQuery;
  onChange: (value: SQLQuery, processQuery: boolean) => void;
  children?: (props: { formatQuery: () => void }) => React.ReactNode;
  width?: number;
  height?: number;
  completionProvider: LanguageCompletionProvider;
};

export function QueryEditorRaw({ children, onChange, query, width, height, completionProvider }: Props) {
  // We need to pass query via ref to SQLEditor as onChange is executed via monacoEditor.onDidChangeModelContent callback, not onChange property
  const queryRef = useRef<SQLQuery>(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

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
      query={query.rawSql!}
      onChange={onRawQueryChange}
      language={{ id: 'sql', completionProvider, formatter: formatSQL }}
    >
      {children}
    </SQLEditor>
  );
}
