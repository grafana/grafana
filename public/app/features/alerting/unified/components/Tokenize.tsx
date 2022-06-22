import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, IconName, useStyles2 } from '@grafana/ui';

import { HoverCard } from './HoverCard';

interface TokenizerProps {
  input: string;
  delimiter?: [string, string];
}

function Tokenize({ input, delimiter = ['{{', '}}'] }: TokenizerProps) {
  const styles = useStyles2(getStyles);

  const [open, close] = delimiter;
  const normalizedIput = normalizeInput(input);

  /**
   * This RegExp uses 2 named capture groups, text that comes before the token and the token itself
   *
   *  <before> open  <token>  close
   *  ───────── ── ─────────── ──
   *  Some text {{ $labels.foo }}
   */
  const regex = new RegExp(`(?<before>.*?)(${open}(?<token>.*?)${close}|$)`, 'gm');

  const matches = Array.from(normalizedIput.matchAll(regex));

  const output: React.ReactNode[] = [];

  matches.forEach((match, index) => {
    const before = match.groups?.before;
    const token = match.groups?.token?.trim();

    const firstMatch = index === 0;

    if (before) {
      if (!firstMatch) {
        output.push(<span> </span>);
      }
      output.push(<span key={`${index}-before`}>{before.trim()}</span>);
    }

    if (token) {
      if (before) {
        output.push(<span> </span>);
      }

      const type = tokenType(token);
      const description = type === TokenType.Variable ? token : '';
      const tokenContent = `${open} ${token} ${close}`;

      output.push(<Token key={`${index}-token`} content={tokenContent} type={type} description={description} />);
    }
  });

  return <span className={styles.wrapper}>{output}</span>;
}

function tokenType(input: string) {
  let tokenType;
  if (isVariable(input)) {
    tokenType = TokenType.Variable;
  } else if (isKeyword(input)) {
    tokenType = TokenType.Keyword;
  } else {
    tokenType = TokenType.Function;
  }

  return tokenType;
}

function isVariable(input: string) {
  return input.startsWith('$') || input.startsWith('.');
}

function isKeyword(input: string) {
  return input === 'end' || input.startsWith('range');
}

enum TokenType {
  Variable = 'variable',
  Function = 'function',
  Keyword = 'keyword',
}

const TokenTypeIcon: Record<TokenType, IconName> = {
  [TokenType.Variable]: 'x',
  // @ts-ignore: sigma has not been added to the typeings
  [TokenType.Function]: 'sigma',
  [TokenType.Keyword]: 'brackets-curly',
};

interface TokenProps {
  content: string;
  type?: TokenType;
  icon?: IconName;
  description?: string;
}

function Token({ content, icon, description, type }: TokenProps) {
  const styles = useStyles2(getStyles);
  const varName = content.trim();

  const iconFromType = icon ?? (type && TokenTypeIcon[type]);
  const showCard = iconFromType && type;

  return (
    <HoverCard
      placement="top-start"
      disabled={!showCard}
      content={
        <div className={styles.hoverTokenItem}>
          <Badge
            text={
              <>
                {iconFromType ? <Icon name={iconFromType} /> : null} {type}
              </>
            }
            color={'blue'}
          />{' '}
          {description && <code>{description}</code>}
        </div>
      }
    >
      <span>
        <Badge className={styles.token} text={varName} color={'blue'} />
      </span>
    </HoverCard>
  );
}

function normalizeInput(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: inline-flex;
    align-items: center;
    white-space: pre;
  `,
  token: css`
    cursor: pointer;
  `,
  popover: css`
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};

    padding: ${theme.spacing(1)};
  `,
  hoverTokenItem: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
});

export { Tokenize, Token };
