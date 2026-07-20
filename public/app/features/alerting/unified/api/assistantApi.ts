import { isFetchError } from '@grafana/runtime';

import { createBridgeURL } from '../components/PluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

const getProxyApiUrl = (path: string) => `/api/plugins/${SupportedPlugin.Assistant}/resources${path}`;

/** How often to refresh investigation state while a report is still generating. */
export const ASSISTANT_INVESTIGATION_POLL_INTERVAL_MS = 3000;

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

// Includes paused — loops can pause mid-run and should keep the "in progress" UI.
const ACTIVE_INVESTIGATION_STATES = new Set(['pending', 'running', 'in_progress', 'in-progress', 'paused']);

const TERMINAL_INVESTIGATION_STATES = new Set(['completed', 'failed', 'cancelled', 'canceled']);

/** True while the Assistant is still producing the report (or paused mid-run). */
export function isAssistantInvestigationActive(state: string | undefined): boolean {
  return !!state && ACTIVE_INVESTIGATION_STATES.has(state);
}

/** True when the investigation finished successfully. */
export function isAssistantInvestigationCompleted(state: string | undefined): boolean {
  return state === 'completed';
}

/** True when the investigation failed or was cancelled. */
export function isAssistantInvestigationFailed(state: string | undefined): boolean {
  return state === 'failed' || state === 'cancelled' || state === 'canceled';
}

/** True when polling can stop — completed, failed, or cancelled. */
export function isAssistantInvestigationTerminal(state: string | undefined): boolean {
  return !!state && TERMINAL_INVESTIGATION_STATES.has(state);
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
          // Lookup cache keys omit startsAt/status/name/generatorURL (set at create or
          // when the rule loads). Normalize so the drawer's lookup query stays keyed.
          const { name: _name, ...rest } = arg;
          const lookupArg: StartInvestigationFromAlertRequest = {
            ...rest,
            alerts: arg.alerts.map(
              ({ startsAt: _startsAt, status: _status, generatorURL: _generatorURL, ...alert }) => alert
            ),
          };
          dispatch(assistantApi.util.upsertQueryData('lookupInvestigationFromAlert', lookupArg, data));
        } catch {
          // Mutation error is surfaced via isError in the button UI.
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

/** Builds a link to the investigation's report in the Assistant app. */
export function getAssistantInvestigationUrl(investigationId: string): string {
  return createBridgeURL(SupportedPlugin.Assistant, `/investigations/${encodeURIComponent(investigationId)}`);
}
