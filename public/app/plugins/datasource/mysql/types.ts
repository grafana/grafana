import { SQLOptions, SQLQuery } from '@grafana/sql';

export interface MySQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
  mySQLRequireTLS?: boolean;
}

export interface MySQLQuery extends SQLQuery {}
