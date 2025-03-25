export type * from './rules/api';

/* Prometheus API success response */
export interface SuccessResponse<Data = unknown> {
  status: 'success';
  data: Data;
}

/* Prometheus API error response */
export interface ErrorResponse {
  status: 'error';
  errorType: string;
  error: string;
}

/* Prometheus API response (either success or error) */
export type Response<Data = unknown> = SuccessResponse<Data> | ErrorResponse;
