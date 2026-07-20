import { type SQLOptions } from '@grafana/sql';

export interface MySQLOptions extends SQLOptions {
  allowCleartextPasswords?: boolean;
}
