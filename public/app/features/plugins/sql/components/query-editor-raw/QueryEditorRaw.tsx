import React, { useCallback, useEffect, useRef } from 'react';

import { LanguageCompletionProvider, SQLEditor } from '@grafana/experimental';

import { SQLQuery } from '../../types';
import { formatSQL } from '../../utils/formatSQL';

type Props<T extends SQLQuery> = {
  query: T;
  onChange: (value: T, processQuery: boolean) => void;
  children?: (props: { formatQuery: () => void }) => React.ReactNode;
  width?: number;
  height?: number;
  completionProvider: LanguageCompletionProvider;
};

export function QueryEditorRaw<T extends SQLQuery>({
  children,
  onChange,
  query,
  width,
  height,
  completionProvider,
}: Props<T>) {
  // We need to pass query via ref to SQLEditor as onChange is executed via monacoEditor.onDidChangeModelContent callback, not onChange property
  const queryRef = useRef<T>(query);
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
