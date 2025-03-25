/* Prometheus API success response */
export interface PrometheusSuccessResponse<Data = unknown> {
  status: 'success';
  data: Data;
}

/* Prometheus API error response */
export interface PrometheusErrorResponse {
  status: 'error';
  errorType: string;
  error: string;
}

/* Prometheus API response (either success or error) */
export type PrometheusApiResponse<Data = unknown> = PrometheusSuccessResponse<Data> | PrometheusErrorResponse;
