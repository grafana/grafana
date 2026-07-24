import { type SQLOptions } from '@grafana/sql';

export interface FlightSQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
}
