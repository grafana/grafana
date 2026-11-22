import { type ConvertAlertmanagerResponse } from '@grafana/alerting/convert';

/**
 * A convert API response the way the backend sends it: on success `errorType` and `error` are empty
 * strings, not left out. Typed as the Alertmanager response, which also covers the rule endpoints' shape.
 */
export function convertResponse(overrides: Partial<ConvertAlertmanagerResponse> = {}): ConvertAlertmanagerResponse {
  return { status: 'success', errorType: '', error: '', ...overrides };
}
