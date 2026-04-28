import { useCallback, useMemo, type ReactNode } from 'react';

import { CodeMirrorEditor, type CodeMirrorCompletionMode } from '@grafana/ui/unstable';

import { getSqlCompletionSource, type SqlCompletionProvider } from './utils';

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  completionProvider?: SqlCompletionProvider;
  completionMode?: CodeMirrorCompletionMode;
  formatter?: (value: string) => string;
  height?: number | string;
  children?: (props: { formatQuery: () => void }) => ReactNode;
}

export const SqlEditor = ({
  value,
  onChange,
  completionProvider,
  completionMode,
  formatter,
  height = '200px',
  children,
}: SqlEditorProps) => {
  const completionSource = useMemo(() => {
    if (!completionProvider) {
      return undefined;
    }

    return getSqlCompletionSource(completionProvider);
  }, [completionProvider]);

  const formatQuery = useCallback(() => {
    if (formatter) {
      onChange(formatter(value));
    }
  }, [formatter, onChange, value]);

  return (
    <>
      <CodeMirrorEditor
        language="sql"
        value={value}
        onChange={onChange}
        height={typeof height === 'number' ? `${height}px` : height}
        completionMode={completionMode}
        completionSources={completionSource ? [completionSource] : undefined}
      />
      {children?.({ formatQuery })}
    </>
  );
};
