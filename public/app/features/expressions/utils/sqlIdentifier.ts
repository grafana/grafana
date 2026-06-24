export type SqlIdentifierDialect = 'mysql' | 'standard';

/**
 * SQL Expressions execute against a MySQL-compatible backend (go-mysql-server), so identifiers are
 * parsed, quoted, and unquoted using the MySQL dialect. This is the single source of truth: the
 * editor's parser dialect and every quote/unquote call use it so the two cannot drift.
 */
export const SQL_EXPRESSIONS_DIALECT: SqlIdentifierDialect = 'mysql';

interface SqlIdentifierDialectRules {
  /** Character used to delimit (and, when doubled, escape) a quoted identifier. */
  quote: string;
  /** Identifiers matching this pattern are safe to leave unquoted in this dialect. */
  unquotedPattern: RegExp;
}

const SQL_IDENTIFIER_DIALECTS = {
  // MySQL delimits identifiers with backticks and permits `$` in unquoted names.
  mysql: { quote: '`', unquotedPattern: /^[a-zA-Z_][a-zA-Z0-9_$]*$/ },
  // ANSI SQL delimits identifiers with double quotes; regular identifiers exclude `$`.
  standard: { quote: '"', unquotedPattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/ },
} satisfies Record<SqlIdentifierDialect, SqlIdentifierDialectRules>;

/**
 * Quotes an identifier for the given dialect when it is not a plain, unquoted-safe name.
 * Embedded quote characters are escaped by doubling them.
 *
 * @example
 * quoteIdentifierIfNecessary('table A', 'mysql') // '`table A`'
 * quoteIdentifierIfNecessary('table A', 'standard') // '"table A"'
 * quoteIdentifierIfNecessary('table', 'mysql') // 'table'
 */
export function quoteIdentifierIfNecessary(value: string, dialect: SqlIdentifierDialect): string {
  const { quote, unquotedPattern } = SQL_IDENTIFIER_DIALECTS[dialect];

  if (unquotedPattern.test(value)) {
    return value;
  }

  return `${quote}${value.replaceAll(quote, `${quote}${quote}`)}${quote}`;
}

/**
 * Strips the dialect's surrounding identifier quotes and unescapes the doubled quote characters
 * inside them. Text that is not quoted for this dialect is returned trimmed and untouched, so a
 * MySQL string literal like `"foo"` is not mistaken for an identifier.
 *
 * @example
 * unquoteIdentifier('`table A`', 'mysql') // 'table A'
 * unquoteIdentifier('"table ""A"""', 'standard') // 'table "A"'
 * unquoteIdentifier('table', 'mysql') // 'table'
 */
export function unquoteIdentifier(identifier: string, dialect: SqlIdentifierDialect): string {
  const trimmed = identifier.trim();
  const { quote } = SQL_IDENTIFIER_DIALECTS[dialect];

  if (trimmed.length >= 2 && trimmed.startsWith(quote) && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).replaceAll(`${quote}${quote}`, quote);
  }

  return trimmed;
}
