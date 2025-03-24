/* Success response */
export interface PrometheusSuccessResponse<Data = unknown> {
  status: 'success';
  data: Data;
}

/* Error response */
export interface PrometheusErrorResponse {
  status: 'error';
  errorType: string;
  error: string;
  data?: never;
}

/* API response (Success or Error) */
export type PrometheusApiResponse<Data = unknown> = PrometheusSuccessResponse<Data> | PrometheusErrorResponse;
