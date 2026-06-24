import { css } from '@emotion/css';
import { useCallback, useMemo, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';

import { SQL_EXPRESSIONS_DIALECT } from '../../../utils/sqlIdentifier';

import { getSqlCompletionSource, type SqlCompletionProvider } from './utils';

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  completionProvider?: SqlCompletionProvider;
  formatter?: (value: string) => string;
  height?: number | string;
  ariaLabel?: string;
  children?: (props: { formatQuery: () => void }) => ReactNode;
}

export const SqlEditor = ({
  value,
  onChange,
  completionProvider,
  formatter,
  height = '200px',
  ariaLabel,
  children,
}: SqlEditorProps) => {
  const styles = useStyles2(getStyles);
  const completionSources = useMemo(() => {
    if (!completionProvider) {
      return undefined;
    }

    return [getSqlCompletionSource(completionProvider)];
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
          // SQL Expressions run against a MySQL backend, where identifiers are quoted with backticks.
          // Same source of truth as identifier quoting so parsing and writing can't drift.
          sqlDialect={SQL_EXPRESSIONS_DIALECT}
          value={value}
          onChange={onChange}
          height={typeof height === 'number' ? `${height}px` : height}
          aria-label={ariaLabel}
          completionSources={completionSources}
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
