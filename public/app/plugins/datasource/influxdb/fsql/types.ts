import { SQLOptions, SQLQuery } from '@grafana/sql';

export interface FlightSQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
}

export interface FlightSQLQuery extends SQLQuery {}
