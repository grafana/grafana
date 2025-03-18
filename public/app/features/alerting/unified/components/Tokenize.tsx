import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, useStyles2 } from '@grafana/ui';

import { PopupCard } from './HoverCard';
import { builtinFunctions as FUNCTIONS, keywords as KEYWORDS } from './receivers/editor/language';

const VARIABLES = ['$', '.', '"'];

interface TokenizerProps {
  input: string;
  delimiter?: [string, string];
}

function Tokenize({ input, delimiter = ['{{', '}}'] }: TokenizerProps) {
  const styles = useStyles2(getStyles);

  const [open, close] = delimiter;

  /**
   * This RegExp uses 2 named capture groups, text that comes before the token and the token itself
   *
   *  <before> open  <token>  close
   *  ───────── ── ─────────── ──
   *  Some text {{ $labels.foo }}
   */
  const regex = new RegExp(`(?<before>.*?)(${open}(?<token>.*?)${close}|$)`, 'gm');
  const lines = input.split('\n');

  const output: React.ReactElement[] = [];

  lines.forEach((line, lineIndex) => {
    const matches = Array.from(line.matchAll(regex));

    matches.forEach((match, matchIndex) => {
      const before = match.groups?.before;
      const token = match.groups?.token?.trim();

      if (before) {
        output.push(<span key={`${lineIndex}-${matchIndex}-before`}>{before}</span>);
      }

      if (token) {
        const type = tokenType(token);
        const description = type === TokenType.Variable ? token : '';
        const tokenContent = `${open} ${token} ${close}`;

        output.push(
          <Token
            key={`${lineIndex}-${matchIndex}-token`}
            content={tokenContent}
            type={type}
            description={description}
          />
        );
      }
    });

    output.push(<br key={`${lineIndex}-newline`} />);
  });

  return <span className={styles.wrapper}>{output}</span>;
}

enum TokenType {
  Variable = 'variable',
  Function = 'function',
  Keyword = 'keyword',
  Unknown = 'unknown',
}

interface TokenProps {
  content: string;
  type?: TokenType;
  description?: string;
}

function Token({ content, description, type }: TokenProps) {
  const styles = useStyles2(getStyles);

  const disableCard = Boolean(type) === false;

  return (
    <PopupCard
      placement="top-start"
      disabled={disableCard}
      content={
        <div className={styles.hoverTokenItem}>
          <Badge tabIndex={0} text={<>{type}</>} color={'blue'} /> {description && <code>{description}</code>}
        </div>
      }
    >
      <span>
        <Badge tabIndex={0} className={styles.token} text={content} color={'blue'} />
      </span>
    </PopupCard>
  );
}

function isVariable(input: string) {
  return VARIABLES.some((character) => input.startsWith(character));
}

function isKeyword(input: string) {
  return KEYWORDS.some((keyword) => input.startsWith(keyword));
}

function isFunction(input: string) {
  return FUNCTIONS.some((functionName) => input.startsWith(functionName));
}

function tokenType(input: string) {
  let tokenType;
  if (isVariable(input)) {
    tokenType = TokenType.Variable;
  } else if (isKeyword(input)) {
    tokenType = TokenType.Keyword;
  } else if (isFunction(input)) {
    tokenType = TokenType.Function;
  } else {
    tokenType = TokenType.Unknown;
  }

  return tokenType;
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    whiteSpace: 'pre-wrap',
  }),
  token: css({
    cursor: 'default',
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  popover: css({
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,

    padding: theme.spacing(1),
  }),
  hoverTokenItem: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});

export { Tokenize, Token };
