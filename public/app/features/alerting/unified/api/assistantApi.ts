import { isFetchError } from '@grafana/runtime';

import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

const getProxyApiUrl = (path: string) => `/api/plugins/${SupportedPlugin.Assistant}/resources${path}`;

/** Labels-only alert used for group identity (lookup / RTK cache key). */
export interface LookupInvestigationAlert {
  labels: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Lookup body: alert-group identity only. Volatile create fields (name, commonLabels,
 * startsAt/endsAt/status/generatorURL) are not part of this contract.
 */
export interface LookupInvestigationFromAlertRequest {
  alerts: LookupInvestigationAlert[];
  groupLabels?: Record<string, string>;
  externalURL?: string;
}

/** AlertManager-style alert for create — includes delivery / episode timing fields. */
export interface StartInvestigationAlert extends LookupInvestigationAlert {
  status?: string;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
}

export interface StartInvestigationFromAlertRequest {
  name?: string;
  alerts: StartInvestigationAlert[];
  commonLabels?: Record<string, string>;
  groupLabels?: Record<string, string>;
  externalURL?: string;
}

/**
 * Strips per-delivery / rule-metadata fields so create/lookup share one RTK cache
 * identity. startsAt, endsAt, status, name, generatorURL, and commonLabels can change
 * while the drawer is open; group identity (alerts[].labels / groupLabels) must not.
 */
export function stableFromAlertRequest(body: StartInvestigationFromAlertRequest): LookupInvestigationFromAlertRequest {
  const { name: _name, commonLabels: _commonLabels, ...rest } = body;
  return {
    ...rest,
    alerts: body.alerts.map(
      ({ startsAt: _startsAt, endsAt: _endsAt, status: _status, generatorURL: _generatorURL, ...alert }) => alert
    ),
  };
}

/** Subset of the Assistant investigation response the alerting UI consumes. */
export interface AssistantInvestigation {
  id: string;
  title: string;
  // Assistant-owned enum: pending / in_progress / paused / completed / failed / cancelled.
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
    // resource route, which enforces the investigations:create permission. Active or
    // completed investigations dedup by alert group; failed/cancelled ones create a
    // fresh investigation on the manual path so "Try again" can recover.
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
          // Seed lookup for this alert-group identity. Poll upserts terminal
          // updates from useStartInvestigation so reopen does not restore pending.
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
    lookupInvestigationFromAlert: build.query<AssistantInvestigation | null, LookupInvestigationFromAlertRequest>({
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
