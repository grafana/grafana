/**
 * MySQL-flavored identifier quoting utilities.
 *
 * These helpers assume backtick (`) as the identifier delimiter and use the
 * MySQL 8.0.31 reserved word list. They are intentionally scoped to a
 * dialect-named namespace so additional dialects (e.g. ANSI SQL) can be added
 * alongside without disturbing existing consumers.
 */

/**
 * Copied from MySQL 8.0.31 INFORMATION_SCHEMA.KEYWORDS
 */
export const MYSQL_RESERVED_WORDS = [
  'ACCESSIBLE',
  'ADD',
  'ALL',
  'ALTER',
  'ANALYZE',
  'AND',
  'AS',
  'ASC',
  'ASENSITIVE',
  'BEFORE',
  'BETWEEN',
  'BIGINT',
  'BINARY',
  'BLOB',
  'BOTH',
  'BY',
  'CALL',
  'CASCADE',
  'CASE',
  'CHANGE',
  'CHAR',
  'CHARACTER',
  'CHECK',
  'COLLATE',
  'COLUMN',
  'CONDITION',
  'CONSTRAINT',
  'CONTINUE',
  'CONVERT',
  'CREATE',
  'CROSS',
  'CUBE',
  'CUME_DIST',
  'CURRENT_DATE',
  'CURRENT_TIME',
  'CURRENT_TIMESTAMP',
  'CURRENT_USER',
  'CURSOR',
  'DATABASE',
  'DATABASES',
  'DAY_HOUR',
  'DAY_MICROSECOND',
  'DAY_MINUTE',
  'DAY_SECOND',
  'DEC',
  'DECIMAL',
  'DECLARE',
  'DEFAULT',
  'DELAYED',
  'DELETE',
  'DENSE_RANK',
  'DESC',
  'DESCRIBE',
  'DETERMINISTIC',
  'DISTINCT',
  'DISTINCTROW',
  'DIV',
  'DOUBLE',
  'DROP',
  'DUAL',
  'EACH',
  'ELSE',
  'ELSEIF',
  'EMPTY',
  'ENCLOSED',
  'ESCAPED',
  'EXCEPT',
  'EXISTS',
  'EXIT',
  'EXPLAIN',
  'FALSE',
  'FETCH',
  'FIRST_VALUE',
  'FLOAT',
  'FLOAT4',
  'FLOAT8',
  'FOR',
  'FORCE',
  'FOREIGN',
  'FROM',
  'FULLTEXT',
  'FUNCTION',
  'GENERATED',
  'GET',
  'GRANT',
  'GROUP',
  'GROUPING',
  'GROUPS',
  'HAVING',
  'HIGH_PRIORITY',
  'HOUR_MICROSECOND',
  'HOUR_MINUTE',
  'HOUR_SECOND',
  'IF',
  'IGNORE',
  'IN',
  'INDEX',
  'INFILE',
  'INNER',
  'INOUT',
  'INSENSITIVE',
  'INSERT',
  'INT',
  'INT1',
  'INT2',
  'INT3',
  'INT4',
  'INT8',
  'INTEGER',
  'INTERSECT',
  'INTERVAL',
  'INTO',
  'IO_AFTER_GTIDS',
  'IO_BEFORE_GTIDS',
  'IS',
  'ITERATE',
  'JOIN',
  'JSON_TABLE',
  'KEY',
  'KEYS',
  'KILL',
  'LAG',
  'LAST_VALUE',
  'LATERAL',
  'LEAD',
  'LEADING',
  'LEAVE',
  'LEFT',
  'LIKE',
  'LIMIT',
  'LINEAR',
  'LINES',
  'LOAD',
  'LOCALTIME',
  'LOCALTIMESTAMP',
  'LOCK',
  'LONG',
  'LONGBLOB',
  'LONGTEXT',
  'LOOP',
  'LOW_PRIORITY',
  'MASTER_BIND',
  'MASTER_SSL_VERIFY_SERVER_CERT',
  'MATCH',
  'MAXVALUE',
  'MEDIUMBLOB',
  'MEDIUMINT',
  'MEDIUMTEXT',
  'MIDDLEINT',
  'MINUTE_MICROSECOND',
  'MINUTE_SECOND',
  'MOD',
  'MODIFIES',
  'NATURAL',
  'NOT',
  'NO_WRITE_TO_BINLOG',
  'NTH_VALUE',
  'NTILE',
  'NULL',
  'NUMERIC',
  'OF',
  'ON',
  'OPTIMIZE',
  'OPTIMIZER_COSTS',
  'OPTION',
  'OPTIONALLY',
  'OR',
  'ORDER',
  'OUT',
  'OUTER',
  'OUTFILE',
  'OVER',
  'PARTITION',
  'PERCENT_RANK',
  'PRECISION',
  'PRIMARY',
  'PROCEDURE',
  'PURGE',
  'RANGE',
  'RANK',
  'READ',
  'READS',
  'READ_WRITE',
  'REAL',
  'RECURSIVE',
  'REFERENCES',
  'REGEXP',
  'RELEASE',
  'RENAME',
  'REPEAT',
  'REPLACE',
  'REQUIRE',
  'RESIGNAL',
  'RESTRICT',
  'RETURN',
  'REVOKE',
  'RIGHT',
  'RLIKE',
  'ROW',
  'ROWS',
  'ROW_NUMBER',
  'SCHEMA',
  'SCHEMAS',
  'SECOND_MICROSECOND',
  'SELECT',
  'SENSITIVE',
  'SEPARATOR',
  'SET',
  'SHOW',
  'SIGNAL',
  'SMALLINT',
  'SPATIAL',
  'SPECIFIC',
  'SQL',
  'SQLEXCEPTION',
  'SQLSTATE',
  'SQLWARNING',
  'SQL_BIG_RESULT',
  'SQL_CALC_FOUND_ROWS',
  'SQL_SMALL_RESULT',
  'SSL',
  'STARTING',
  'STORED',
  'STRAIGHT_JOIN',
  'SYSTEM',
  'TABLE',
  'TERMINATED',
  'THEN',
  'TINYBLOB',
  'TINYINT',
  'TINYTEXT',
  'TO',
  'TRAILING',
  'TRIGGER',
  'TRUE',
  'UNDO',
  'UNION',
  'UNIQUE',
  'UNLOCK',
  'UNSIGNED',
  'UPDATE',
  'USAGE',
  'USE',
  'USING',
  'UTC_DATE',
  'UTC_TIME',
  'UTC_TIMESTAMP',
  'VALUES',
  'VARBINARY',
  'VARCHAR',
  'VARCHARACTER',
  'VARYING',
  'VIRTUAL',
  'WHEN',
  'WHERE',
  'WHILE',
  'WINDOW',
  'WITH',
  'WRITE',
  'XOR',
  'YEAR_MONTH',
  'ZEROFILL',
] as const;

const RESERVED_WORDS_SET = new Set<string>(MYSQL_RESERVED_WORDS);

/**
 * Validates the identifier and returns true if it does not need to be escaped.
 *
 * A valid identifier:
 * - Does not start with a digit
 * - Contains only letters, digits, underscores, and dollar signs
 * - Is not a reserved word
 */
function isValidIdentifier(identifier: string): boolean {
  const isValidName = /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier);
  const isReservedWord = RESERVED_WORDS_SET.has(identifier.toUpperCase());
  return !isReservedWord && isValidName;
}

/**
 * Wraps the identifier in backticks if necessary.
 *
 * This function is idempotent: if the value is already backtick-wrapped, it is
 * returned unchanged. Embedded backticks are escaped by doubling them,
 * consistent with MySQL/ANSI escape rules.
 */
function quoteIdentifierIfNecessary(value: string): string {
  // Idempotent: already backtick-wrapped
  if (value.length >= 2 && value.startsWith('`') && value.endsWith('`')) {
    return value;
  }

  if (isValidIdentifier(value)) {
    return value;
  }

  // Escape embedded backticks by doubling them
  const escaped = value.replace(/`/g, '``');
  return `\`${escaped}\``;
}

/**
 * Removes identifier quoting from an identifier.
 *
 * Supports both double-quote (") and backtick (`) delimiters. Handles
 * doubled delimiter escape sequences.
 */
function unquoteIdentifier(value: string): string {
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    return value.substring(1, value.length - 1).replace(/""/g, '"');
  }

  if (value.length >= 2 && value[0] === '`' && value[value.length - 1] === '`') {
    return value.substring(1, value.length - 1).replace(/``/g, '`');
  }

  return value;
}

export const mysqlIdentifier = {
  isValidIdentifier,
  quoteIdentifierIfNecessary,
  unquoteIdentifier,
};
