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

  // Qualified names (db.schema.table) are quoted per segment so each level
  // resolves independently.
  return value
    .split('.')
    .map((segment) =>
      unquotedPattern.test(segment) ? segment : `${quote}${segment.replaceAll(quote, `${quote}${quote}`)}${quote}`
    )
    .join('.');
}

export function unquoteIdentifier(identifier: string, dialect: SqlIdentifierDialect): string {
  const { quote } = SQL_IDENTIFIER_DIALECTS[dialect];

  return identifier
    .trim()
    .split('.')
    .map((segment) => {
      if (segment.length >= 2 && segment.startsWith(quote) && segment.endsWith(quote)) {
        return segment.slice(1, -1).replaceAll(`${quote}${quote}`, quote);
      }

      return segment;
    })
    .join('.');
}
