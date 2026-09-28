export type SqlIdentifierDialect = 'mysql' | 'standard';

interface SqlIdentifierDialectRules {
  quote: string;
  unquotedPattern: RegExp;
}

const SQL_IDENTIFIER_DIALECTS = {
  mysql: { quote: '`', unquotedPattern: /^[a-zA-Z_][a-zA-Z0-9_$]*$/ },
  standard: { quote: '"', unquotedPattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/ },
} satisfies Record<SqlIdentifierDialect, SqlIdentifierDialectRules>;

export function quoteIdentifierIfNecessary(value: string, dialect: SqlIdentifierDialect): string {
  const { quote, unquotedPattern } = SQL_IDENTIFIER_DIALECTS[dialect];

  if (unquotedPattern.test(value)) {
    return value;
  }

  return `${quote}${value.replaceAll(quote, `${quote}${quote}`)}${quote}`;
}

export function unquoteIdentifier(identifier: string, dialect: SqlIdentifierDialect): string {
  const trimmed = identifier.trim();
  const { quote } = SQL_IDENTIFIER_DIALECTS[dialect];

  if (trimmed.length >= 2 && trimmed.startsWith(quote) && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).replaceAll(`${quote}${quote}`, quote);
  }

  return trimmed;
}
