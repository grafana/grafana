export interface GrafanaGroupUpdatedResponse {
  message: string;
  /**
   * UIDs of rules created from this request
   */
  created?: string[];
  /**
   * UIDs of rules updated from this request
   */
  updated?: string[];
}

export interface CloudGroupUpdatedResponse {
  error: string;
  errorType: string;
  status: 'error' | 'success';
}

export type RulerGroupUpdatedResponse = GrafanaGroupUpdatedResponse | CloudGroupUpdatedResponse;

export function isGrafanaGroupUpdatedResponse(
  response: RulerGroupUpdatedResponse
): response is GrafanaGroupUpdatedResponse {
  return 'message' in response;
}

export function isCloudGroupUpdatedResponse(
  response: RulerGroupUpdatedResponse
): response is CloudGroupUpdatedResponse {
  return 'status' in response;
}
