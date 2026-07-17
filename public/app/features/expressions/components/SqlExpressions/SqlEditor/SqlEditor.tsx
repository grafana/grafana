import { css } from '@emotion/css';
import { useCallback, useMemo, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor, signatureHelp, type CodeMirrorSqlDialect } from '@grafana/ui/unstable';

import { SQL_EXPRESSIONS_DIALECT } from '../../../utils/sqlIdentifier';

import { getSqlSignatureHelpProvider, type SqlFunctionSignature } from './signatureHelp';
import { getSqlCompletionSource, type SqlCompletionProvider } from './utils';

// SQL Expressions run against a MySQL backend, where identifiers are quoted with backticks.
// Maps the identifier-quoting dialect (single source of truth) to the CodeMirror SQL dialect so
// parsing and writing can't drift, while still letting callers override it via the `dialect` prop.
const DEFAULT_CODE_MIRROR_SQL_DIALECT: CodeMirrorSqlDialect =
  SQL_EXPRESSIONS_DIALECT === 'mysql' ? 'mySql' : 'standardSql';

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  completionProvider?: SqlCompletionProvider;
  functionSignatures?: SqlFunctionSignature[];
  formatter?: (value: string) => string;
  height?: number | string;
  ariaLabel?: string;
  /**
   * SQL dialect used for syntax highlighting and keyword completion.
   * Defaults to the dialect SQL Expressions run against (MySQL).
   */
  dialect?: CodeMirrorSqlDialect;
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
  dialect = DEFAULT_CODE_MIRROR_SQL_DIALECT,
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
          sqlDialect={dialect}
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
    border: `1px solid ${theme.components.input.borderColor}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
});
