import { ActiveNotification } from './alerts';

interface AlertmanagerSuccessResponse<T> {
  status: 'success';
  data: T;
}

interface AlertmanagerErrorResponse {
  status: 'error';
  errorType: string; // Type of the error (e.g., "bad_request", "internal_error")
  error: string; // Detailed error message
}

export type AlertmanagerApiResponse<T> = AlertmanagerSuccessResponse<T> | AlertmanagerErrorResponse;

/*
 * A list of active notifications
 * /api/v2/alerts
 */
export type AlertmanagerApiAlertsResponse = ActiveNotification[];
