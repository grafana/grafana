import { css, cx } from '@emotion/css';
import Prism from 'prismjs';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useTheme2 } from '@grafana/ui/src';

import {
  highlightErrorsInQuery,
  placeHolderScopedVars,
  processErrorTokens,
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
  const highlighted = Prism.highlight(
    highlightErrorsInQuery(datasource.interpolateString(query, placeHolderScopedVars)),
    lokiGrammar,
    'lokiql'
  );

  Prism.hooks.add('after-tokenize', function (env) {
    if (env.language !== 'lokiql') {
      return;
    }

    env.tokens = processErrorTokens(env.tokens);
    console.log(env.tokens);
  });
  Prism.hooks.add('wrap', (env) => {
    if (env.language !== 'lokiql') {
      return;
    }
    if (env.type === 'error') {
      env.classes.push(styles.queryError);
    }
  });

  return (
    <div
      className={cx(styles.editorField, 'prism-syntax-highlight', className)}
      aria-label="selector"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editorField: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    queryError: css`
      color: ${theme.colors.error.main} !important;
      text-decoration: underline wavy;
    `,
  };
};
