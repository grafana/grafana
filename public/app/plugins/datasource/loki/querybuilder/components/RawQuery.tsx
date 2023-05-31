import { css, cx } from '@emotion/css';
import Prism from 'prismjs';
import React, { useEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Alert, Tooltip, useTheme2 } from '@grafana/ui/src';

import {
  highlightErrorsInQuery,
  placeHolderScopedVars,
  processErrorTokens,
  validateQuery,
} from '../../components/monaco-query-field/monaco-completion-provider/validation';
import { LokiDatasource } from '../../datasource';
import { lokiGrammar } from '../../syntax';

export interface Props {
  query: string;
  className?: string;
  datasource: LokiDatasource;
}

export function RawQuery({ query, className, datasource }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const interpolatedQuery = useMemo(
    () => datasource.interpolateString(query, placeHolderScopedVars),
    [datasource, query]
  );
  const highlighted = Prism.highlight(highlightErrorsInQuery(query, interpolatedQuery), lokiGrammar, 'lokiql');
  const hasErrors = useMemo(() => validateQuery(query, interpolatedQuery, [query]), [query, interpolatedQuery]);

  useEffect(() => {
    Prism.hooks.add('after-tokenize', function (env) {
      if (env.language !== 'lokiql') {
        return;
      }

      env.tokens = processErrorTokens(env.tokens);
    });
    Prism.hooks.add('wrap', (env) => {
      if (env.language !== 'lokiql') {
        return;
      }
      if (env.type === 'error') {
        env.classes.push(styles.queryError);
      }
    });
  }, [styles.queryError]);

  return (
    <>
      <Tooltip
        content={hasErrors ? 'The query appears to be incorrect and could fail to be executed' : 'The query is valid'}
      >
        <div
          className={cx(styles.editorField, 'prism-syntax-highlight', className)}
          aria-label="selector"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </Tooltip>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editorField: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    queryError: css`
      color: ${theme.colors.error.text} !important;
      text-decoration: underline wavy;
    `,
  };
};
