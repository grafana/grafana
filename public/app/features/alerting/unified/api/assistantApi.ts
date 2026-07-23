import { isFetchError } from '@grafana/runtime';

import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

const getProxyApiUrl = (path: string) => `/api/plugins/${SupportedPlugin.Assistant}/resources${path}`;

/** An AlertManager-style alert, matching the payload the Assistant's from-alert endpoint accepts. */
interface AssistantAlert {
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

/**
 * Strips per-delivery / rule-metadata fields so create/lookup share one RTK cache
 * identity. startsAt, status, name, and generatorURL can appear after Start or when
 * the rule query resolves; group identity (labels) must not change mid-drawer.
 */
export function stableFromAlertRequest(body: StartInvestigationFromAlertRequest): StartInvestigationFromAlertRequest {
  const { name: _name, ...rest } = body;
  return {
    ...rest,
    alerts: body.alerts.map(({ startsAt: _startsAt, status: _status, generatorURL: _generatorURL, ...alert }) => alert),
  };
}

/** Subset of the Assistant investigation response the alerting UI consumes. */
export interface AssistantInvestigation {
  id: string;
  title: string;
  // Assistant-owned enum; known values include pending / in_progress / paused / completed / failed / cancelled.
  state: string;
  chatId?: string;
}

function unwrapAssistantDataResponse(response: unknown): AssistantInvestigation {
  if (typeof response !== 'object' || response === null || !('data' in response)) {
    throw new Error('Invalid Assistant investigation response');
  }

  const data = response.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    typeof data.id !== 'string' ||
    !('title' in data) ||
    typeof data.title !== 'string' ||
    !('state' in data) ||
    typeof data.state !== 'string'
  ) {
    throw new Error('Invalid Assistant investigation response');
  }

  const investigation: AssistantInvestigation = {
    id: data.id,
    title: data.title,
    state: data.state,
  };

  if ('chatId' in data && typeof data.chatId === 'string') {
    investigation.chatId = data.chatId;
  }

  return investigation;
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
        notificationOptions: { showErrorAlert: false },
      }),
      transformResponse: (response: unknown) => unwrapAssistantDataResponse(response),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Keep the drawer's lookup query keyed to the stable alert-group identity.
          dispatch(
            assistantApi.util.upsertQueryData('lookupInvestigationFromAlert', stableFromAlertRequest(arg), data)
          );
        } catch {
          // Mutation error is surfaced via isError in the UI.
        }
      },
    }),

    // Read-only: return the investigation already linked to this alert group, or null
    // when none exists (404). Used when reopening the instance drawer.
    lookupInvestigationFromAlert: build.query<AssistantInvestigation | null, StartInvestigationFromAlertRequest>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        const result = await baseQuery({
          url: getProxyApiUrl('/api/v1/investigations/from-alert/lookup'),
          data: body,
          method: 'POST',
          notificationOptions: { showErrorAlert: false },
        });

        if (result.error) {
          if (isFetchError(result.error) && result.error.status === 404) {
            return { data: null };
          }
          return { error: result.error };
        }

        try {
          return { data: unwrapAssistantDataResponse(result.data) };
        } catch (error) {
          return { error };
        }
      },
    }),

    // Poll investigation row state (pending → in_progress → completed/failed).
    getAssistantInvestigation: build.query<AssistantInvestigation, string>({
      query: (investigationId) => ({
        url: getProxyApiUrl(`/api/v1/investigations/${encodeURIComponent(investigationId)}`),
        method: 'GET',
        notificationOptions: { showErrorAlert: false },
      }),
      transformResponse: (response: unknown) => unwrapAssistantDataResponse(response),
    }),
  }),
});
