import { type SQLOptions, type SQLQuery } from '@grafana/sql';

export interface MySQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
}

export interface MySQLQuery extends SQLQuery {}
