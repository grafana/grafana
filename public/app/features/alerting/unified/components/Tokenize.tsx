import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, useStyles2 } from '@grafana/ui';

interface TokenizerProps {
  input: string;
  delimiter?: [string, string];
}

function Tokenize({ input, delimiter = ['{{', '}}'] }: TokenizerProps) {
  const styles = useStyles2(getStyles);

  const [open, close] = delimiter;
  const regex = new RegExp(`(?<before>.*?)(${open}(?<token>.*?)${close}|$)`, 'gm');

  const matches = Array.from(input.matchAll(regex));

  const output: React.ReactNode[] = [];

  matches.forEach((match, index) => {
    const before = match.groups?.before;
    const token = match.groups?.token;

    if (before) {
      output.push(<span> </span>);
      output.push(<span key={`${index}-before`}>{match.groups?.before.trim()}</span>);
    }
    if (token) {
      output.push(<span> </span>);
      output.push(<Token key={`${index}-token`} name={token} />);
    }
  });

  return <span className={styles.wrapper}>{output}</span>;
}

interface TokenProps {
  name: string;
}

function Token({ name }: TokenProps) {
  const styles = useStyles2(getStyles);
  const varName = name.trim();

  return <Badge icon="x" className={styles.token} text={varName} color={'blue'} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: inline-flex;
    align-items: center;
    white-space: pre;
  `,
  token: css``,
  popover: css`
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};

    padding: ${theme.spacing(1)};
  `,
});

export { Tokenize, Token };
