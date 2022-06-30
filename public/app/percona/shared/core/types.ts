export enum Databases {
  postgresql = 'postgresql',
  mongodb = 'mongodb',
  mysql = 'mysql',
  mariadb = 'mariadb',
  proxysql = 'proxysql',
  haproxy = 'haproxy',
}

export enum ApiErrorCode {
  ERROR_CODE_XTRABACKUP_NOT_INSTALLED = 'ERROR_CODE_XTRABACKUP_NOT_INSTALLED',
  ERROR_CODE_INVALID_XTRABACKUP = 'ERROR_CODE_INVALID_XTRABACKUP',
  ERROR_CODE_INCOMPATIBLE_XTRABACKUP = 'ERROR_CODE_INCOMPATIBLE_XTRABACKUP',
  ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL = 'ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL',
}

interface ApiDetailedError {
  code: ApiErrorCode;
}

export interface ApiError {
  details: ApiDetailedError[];
}

export interface ApiVerboseError {
  message: string;
  link?: string;
}

export interface PaginatedPayload {
  page_totals: {
    total_items: number;
    total_pages: number;
  };
}

export interface ApiParamBody {
  [key: string]: {
    intValues?: number[];
    longValues?: number[];
    stringValues?: string[];
  };
}

export interface ApiParams {
  filter_params: {
    [key: string]: {
      int_values: {
        values: number[];
      };
      long_values: {
        values: number[];
      };
      string_values: {
        values: string[];
      };
    };
  };
}

export interface PaginatedFomattedResponse<T = any> {
  data: T;
  totals: {
    totalItems: number;
    totalPages: number;
  };
}

export interface PrioritizedLabels {
  primary: string[];
  secondary: string[];
}

export interface ServerInfo {
  serverName: string;
  serverId: string;
}

export enum Severity {
  SEVERITY_EMERGENCY = 'Emergency',
  SEVERITY_ALERT = 'Alert',
  SEVERITY_CRITICAL = 'Critical',
  SEVERITY_ERROR = 'Error',
  SEVERITY_WARNING = 'Warning',
  SEVERITY_NOTICE = 'Notice',
  SEVERITY_INFO = 'Info',
  SEVERITY_DEBUG = 'Debug',
}
