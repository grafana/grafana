import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

const getProxyApiUrl = (path: string) => `/api/plugins/${SupportedPlugin.Assistant}/resources${path}`;

/** An AlertManager-style alert, matching the payload the Assistant's from-alert endpoint accepts. */
export interface AssistantAlert {
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  status?: string;
  startsAt?: string;
  generatorURL?: string;
}

export interface StartInvestigationFromAlertRequest {
  name?: string;
  alerts: AssistantAlert[];
  commonLabels?: Record<string, string>;
  groupLabels?: Record<string, string>;
  externalURL?: string;
}

/** Subset of the Assistant investigation response the alerting UI consumes. */
export interface AssistantInvestigation {
  id: string;
  title: string;
  // "running" | "completed" | "failed" — kept a free string as the Assistant owns the enum.
  state: string;
  chatId?: string;
}

// The Assistant API wraps handler results in { status, data }.
interface FromAlertResponse {
  status: string;
  data: AssistantInvestigation;
}

export const assistantApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    // Manually start an investigation from an alert (POC: firing alert instance ->
    // Assistant investigation). Proxied through the Assistant plugin's authenticated
    // resource route, which enforces the investigations:create permission. The
    // endpoint dedups by alert group, so repeat calls return the existing investigation.
    startInvestigationFromAlert: build.mutation<AssistantInvestigation, StartInvestigationFromAlertRequest>({
      query: (body) => ({
        url: getProxyApiUrl('/api/v1/investigations/from-alert'),
        data: body,
        method: 'POST',
        showErrorAlert: false,
      }),
      transformResponse: (response: FromAlertResponse) => response.data,
    }),
  }),
});

/** Builds a link to the investigation's report in the Assistant workspace. */
export function getAssistantInvestigationUrl(investigationId: string): string {
  return `/a/${SupportedPlugin.Assistant}/investigations/${investigationId}`;
}
