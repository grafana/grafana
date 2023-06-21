import { isEmpty } from 'lodash';

import { SQLQuery } from 'app/features/plugins/sql/types';
import { createSelectClause, haveColumns } from 'app/features/plugins/sql/utils/sql.utils';

export function toRawSql({ sql, dataset, table }: SQLQuery): string {
  let rawQuery = '';

  // Return early with empty string if there is no sql column
  if (!sql || !haveColumns(sql.columns)) {
    return rawQuery;
  }

  rawQuery += createSelectClause(sql.columns);

  if (dataset && table) {
    rawQuery += `FROM ${dataset}.${table} `;
  }

  if (sql.whereString) {
    rawQuery += `WHERE ${sql.whereString} `;
  }

  if (sql.groupBy?.[0]?.property.name) {
    const groupBy = sql.groupBy.map((g) => g.property.name).filter((g) => !isEmpty(g));
    rawQuery += `GROUP BY ${groupBy.join(', ')} `;
  }

  if (sql.orderBy?.property.name) {
    rawQuery += `ORDER BY ${sql.orderBy.property.name} `;
  }

  if (sql.orderBy?.property.name && sql.orderByDirection) {
    rawQuery += `${sql.orderByDirection} `;
  }

  // Altough LIMIT 0 doesn't make sense, it is still possible to have LIMIT 0
  if (sql.limit !== undefined && sql.limit >= 0) {
    rawQuery += `LIMIT ${sql.limit} `;
  }
  return rawQuery;
}

// Puts backticks (`) around the identifier if it is necessary.
export function quoteIdentifierIfNecessary(value: string) {
  return isValidIdentifier(value) ? value : `\`${value}\``;
}

/**
 * Validates the identifier from MySql and returns true if it
 * doesn't need to be escaped.
 */
export function isValidIdentifier(identifier: string): boolean {
  const isValidName = /^[a-zA-Z_][a-zA-Z0-9_$]*$/g.test(identifier);
  const isReservedWord = RESERVED_WORDS.includes(identifier.toUpperCase());
  return !isReservedWord && isValidName;
}

// remove identifier quoting from identifier to use in metadata queries
export function unquoteIdentifier(value: string) {
  if (value[0] === '"' && value[value.length - 1] === '"') {
    return value.substring(1, value.length - 1).replace(/""/g, '"');
  } else if (value[0] === '`' && value[value.length - 1] === '`') {
    return value.substring(1, value.length - 1);
  } else {
    return value;
  }
}

export function quoteLiteral(value: string) {
  return "'" + value.replace(/'/g, "''") + "'";
}

/**
 * Copied from MySQL 8.0.31 INFORMATION_SCHEMA.KEYWORDS
 */
const RESERVED_WORDS = [
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
];
