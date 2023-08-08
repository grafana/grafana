import { SQLOptions, SQLQuery } from 'app/features/plugins/sql/types';

export interface MySQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
  enableMySQLMultiStatements?: boolean;
}

export interface MySQLQuery extends SQLQuery {}
