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
