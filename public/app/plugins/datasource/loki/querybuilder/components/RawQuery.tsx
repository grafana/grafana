import { css, cx } from '@emotion/css';
import Prism, { Token } from 'prismjs';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useTheme2 } from '@grafana/ui/src';

import { highlightErrorsInQuery } from '../../components/monaco-query-field/monaco-completion-provider/validation';
import { lokiGrammar } from '../../syntax';

export interface Props {
  query: string;
  className?: string;
}

export function RawQuery({ query, className }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const highlighted = Prism.highlight(highlightErrorsInQuery(query), lokiGrammar, 'lokiql');

  Prism.hooks.add('after-tokenize', function (env) {
    if (env.language !== 'lokiql') {
      return;
    }

    let errorZone = false;
    env.tokens = env.tokens.map((token: string | Token) => {
      if (typeof token !== 'string') {
        return errorZone ? new Prism.Token('error', token.content) : token;
      }
      if (token.includes('%err')) {
        errorZone = true;
        return new Prism.Token('error', token.replace('%err', ''));
      }

      if (token.includes('err%')) {
        errorZone = false;
        return new Prism.Token('error', token.replace('err%', ''));
      }

      return token;
    });
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
      color: ${theme.colors.error.main};
      text-decoration: underline wavy;
    `,
  };
};
