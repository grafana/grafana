export interface SQLConnectionLimits {
  maxOpenConns: number;
  maxIdleConns: number;
  connMaxLifetime: number;
}
