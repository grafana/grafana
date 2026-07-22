import { type SqlIdentifierDialect } from '@grafana/sql';

/**
 * SQL Expressions execute against a MySQL-compatible backend (go-mysql-server), so identifiers are
 * parsed, quoted, and unquoted using the MySQL dialect. This is the single source of truth: the
 * editor's parser dialect and every quote/unquote call use it so the two cannot drift.
 */
export const SQL_EXPRESSIONS_DIALECT: SqlIdentifierDialect = 'mysql';
