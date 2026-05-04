import { css } from '@emotion/css';
import { useCallback, useMemo, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor, type CodeMirrorCompletionMode } from '@grafana/ui/unstable';

import { getSqlCompletionSource, type SqlCompletionProvider } from './utils';

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  completionProvider?: SqlCompletionProvider;
  completionMode?: CodeMirrorCompletionMode;
  formatter?: (value: string) => string;
  height?: number | string;
  ariaLabel?: string;
  children?: (props: { formatQuery: () => void }) => ReactNode;
}

export const SqlEditor = ({
  value,
  onChange,
  completionProvider,
  completionMode,
  formatter,
  height = '200px',
  ariaLabel,
  children,
}: SqlEditorProps) => {
  const styles = useStyles2(getStyles);
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
      <div className={styles.editorBorder}>
        <CodeMirrorEditor
          language="sql"
          value={value}
          onChange={onChange}
          height={typeof height === 'number' ? `${height}px` : height}
          aria-label={ariaLabel}
          completionMode={completionMode}
          completionSources={completionSource ? [completionSource] : undefined}
        />
      </div>
      {children?.({ formatQuery })}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorBorder: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
});
