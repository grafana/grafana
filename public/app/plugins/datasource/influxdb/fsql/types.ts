import { SQLOptions, SQLQuery } from 'app/features/plugins/sql/types';

export interface FlightSQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
}

export interface FlightSQLQuery extends SQLQuery {}
