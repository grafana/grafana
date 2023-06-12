import { SQLOptions, SQLQuery } from 'app/features/plugins/sql/types';

export interface MySQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
}

export interface MySQLQuery extends SQLQuery {}
