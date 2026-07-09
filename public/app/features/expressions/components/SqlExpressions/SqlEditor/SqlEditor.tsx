import { css } from '@emotion/css';
import { useCallback, useMemo, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor, signatureHelp } from '@grafana/ui/unstable';

import { SQL_EXPRESSIONS_DIALECT } from '../../../utils/sqlIdentifier';

import { getSqlSignatureHelpProvider, type SqlFunctionSignature } from './signatureHelp';
import { getSqlCompletionSource, type SqlCompletionProvider } from './utils';

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  completionProvider?: SqlCompletionProvider;
  functionSignatures?: SqlFunctionSignature[];
  formatter?: (value: string) => string;
  height?: number | string;
  ariaLabel?: string;
  children?: (props: { formatQuery: () => void }) => ReactNode;
}

export const SqlEditor = ({
  value,
  onChange,
  completionProvider,
  functionSignatures,
  formatter,
  height = '200px',
  ariaLabel,
  children,
}: SqlEditorProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const completionSources = useMemo(() => {
    if (!completionProvider) {
      return undefined;
    }

    return [getSqlCompletionSource(completionProvider)];
  }, [completionProvider]);

  const extensions = useMemo(() => {
    if (!functionSignatures?.length) {
      return undefined;
    }

    return [signatureHelp(getSqlSignatureHelpProvider(functionSignatures), { theme })];
  }, [functionSignatures, theme]);

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
          extensions={extensions}
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
