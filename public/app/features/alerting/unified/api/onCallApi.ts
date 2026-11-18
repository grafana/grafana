import { compact, range, uniq, uniqBy } from 'lodash';

import { type FetchError, getBackendSrv, isFetchError } from '@grafana/runtime';

import { GRAFANA_ONCALL_INTEGRATION_TYPE } from '../components/receivers/grafanaAppReceivers/onCall/onCall';

import { alertingApi } from './alertingApi';

export interface NewOnCallIntegrationDTO {
  id: string;
  connected_escalations_chains_count: number;
  integration: string;
  integration_url: string;
  verbal_name: string;
}

interface OnCallPaginatedResult<T> {
  results: T[];
  total_pages: number;
}

export const SHIFTS_LOOKAHEAD_DAYS = 30;
export const SCHEDULE_PAGE_SIZE = 100;
// Org-wide teams can own hundreds of schedules; the homepage stops the team list after this many pages.
const SCHEDULE_MAX_PAGES = 5;

/** Short user shape OnCall embeds in a schedule's `on_call_now`. */
export interface OnCallShortUser {
  pk: string;
  username: string;
  avatar: string;
  avatar_full: string;
}

/** One final-schedule event from `schedules/current_user_events/`. */
export interface OnCallScheduleEvent {
  start: string;
  end: string;
  all_day: boolean;
  users: Array<{ pk: string; display_name: string; email: string; avatar_full: string }>;
}

/** The user's shifts on one schedule, as `schedules/current_user_events/` reports them. */
export interface OnCallUserScheduleEvents {
  id: string;
  name: string;
  events: OnCallScheduleEvent[];
}

export interface CurrentUserEventsResponse {
  schedules: OnCallUserScheduleEvents[];
}

export interface OnCallScheduleDTO {
  id: string;
  name: string;
  team: string | null;
  on_call_now: OnCallShortUser[];
}

export const ONCALL_INTEGRATION_V2_FEATURE = 'grafana_alerting_v2';
type OnCallFeature = typeof ONCALL_INTEGRATION_V2_FEATURE | string;

type AlertReceiveChannelsResult = OnCallPaginatedResult<OnCallIntegrationDTO> | OnCallIntegrationDTO[];

export interface OnCallIntegrationDTO {
  value: string;
  display_name: string;
  integration_url: string;
}

export interface CreateIntegrationDTO {
  integration: typeof GRAFANA_ONCALL_INTEGRATION_TYPE; // The only one supported right now
  verbal_name: string;
}

export interface OnCallConfigChecks {
  is_chatops_connected: boolean;
  is_integration_chatops_connected: boolean;
}

export function getProxyApiUrl(path: string, pluginId: string) {
  return `/api/plugins/${pluginId}/resources${path}`;
}

function grafanaOnCallIntegrationsRequest(pluginId: string) {
  return {
    url: getProxyApiUrl('/alert_receive_channels/', pluginId),
    // legacy_grafana_alerting is necessary for OnCall.
    // We do NOT need to differentiate between these two on our side
    params: {
      filters: true,
      integration: [GRAFANA_ONCALL_INTEGRATION_TYPE, 'legacy_grafana_alerting'],
      skip_pagination: true,
    },
    showErrorAlert: false,
  };
}

// Page 1 reports total_pages; later pages load in parallel. `next` links point at the engine host, so
// the page number, not the link, drives pagination. Repeated `team` params OR together on the engine.
async function fetchSchedulePages(
  pluginId: string,
  filter: { mine: true } | { team: string[] },
  abortSignal: AbortSignal,
  maxPages = Infinity
): Promise<OnCallScheduleDTO[]> {
  const fetchPage = (page: number) =>
    getBackendSrv().get<OnCallPaginatedResult<OnCallScheduleDTO>>(
      getProxyApiUrl('/schedules/', pluginId),
      { ...filter, perpage: SCHEDULE_PAGE_SIZE, page },
      undefined,
      { showErrorAlert: false, abortSignal }
    );
  const first = await fetchPage(1);
  const pageCount = Math.min(first.total_pages, maxPages);
  const rest = await Promise.all(range(2, pageCount + 1).map(fetchPage));
  return [first, ...rest].flatMap((page) => page.results);
}

export const onCallApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    grafanaOnCallIntegrations: build.query<OnCallIntegrationDTO[], { pluginId: string }>({
      query: ({ pluginId }) => grafanaOnCallIntegrationsRequest(pluginId),
      transformResponse: readOnCallIntegrations,
      providesTags: ['OnCallIntegrations'],
    }),
    validateIntegrationName: build.query<boolean, { name: string; pluginId: string }>({
      query: ({ name, pluginId }) => ({
        url: getProxyApiUrl('/alert_receive_channels/validate_name/', pluginId),
        params: { verbal_name: name },
        showErrorAlert: false,
      }),
    }),
    createIntegration: build.mutation<NewOnCallIntegrationDTO, CreateIntegrationDTO & { pluginId: string }>({
      query: ({ pluginId, ...integration }) => ({
        url: getProxyApiUrl('/alert_receive_channels/', pluginId),
        data: integration,
        method: 'POST',
        showErrorAlert: true,
      }),
      invalidatesTags: ['OnCallIntegrations'],
    }),
    features: build.query<OnCallFeature[], { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: getProxyApiUrl('/features/', pluginId),
        showErrorAlert: false,
      }),
    }),
    onCallConfigChecks: build.query<OnCallConfigChecks, { pluginId: string }>({
      query: ({ pluginId }) => ({
        url: getProxyApiUrl('/organization/config-checks/', pluginId),
        showErrorAlert: false,
      }),
    }),
    getCurrentUserEvents: build.query<OnCallUserScheduleEvents[], { pluginId: string; date: string; userTz: string }>({
      query: ({ pluginId, date, userTz }) => ({
        url: getProxyApiUrl('/schedules/current_user_events/', pluginId),
        params: { date, days: SHIFTS_LOOKAHEAD_DAYS, user_tz: userTz },
        showErrorAlert: false,
      }),
      transformResponse: (response: CurrentUserEventsResponse) => response.schedules,
    }),
    /** The user's own schedules plus every schedule of the teams those belong to, each with who is on call now. */
    getRelatedSchedules: build.query<OnCallScheduleDTO[], { pluginId: string }>({
      queryFn: async ({ pluginId }, { signal }) => {
        try {
          // The user's own list is read in full: every schedule they have a shift on must be in it.
          const mine = await fetchSchedulePages(pluginId, { mine: true }, signal);
          const team = uniq(compact(mine.map((schedule) => schedule.team)));
          const ofTeams = team.length ? await fetchSchedulePages(pluginId, { team }, signal, SCHEDULE_MAX_PAGES) : [];
          return { data: uniqBy([...mine, ...ofTeams], 'id') };
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});

function isPaginatedResponse(
  response: AlertReceiveChannelsResult
): response is OnCallPaginatedResult<OnCallIntegrationDTO> {
  return 'results' in response && Array.isArray(response.results);
}

// OnCall returns the integration list bare or paginated depending on version; read both shapes.
function readOnCallIntegrations(response: AlertReceiveChannelsResult): OnCallIntegrationDTO[] {
  return isPaginatedResponse(response) ? response.results : response;
}

/** The Grafana Alerting integrations configured in OnCall/IRM. */
export async function fetchGrafanaOnCallIntegrations(
  pluginId: string,
  abortSignal?: AbortSignal
): Promise<OnCallIntegrationDTO[]> {
  const { url, params, showErrorAlert } = grafanaOnCallIntegrationsRequest(pluginId);
  const response = await getBackendSrv().get<AlertReceiveChannelsResult>(url, params, undefined, {
    showErrorAlert,
    abortSignal,
  });
  return readOnCallIntegrations(response);
}

export const {} = onCallApi;

export function isOnCallFetchError(error: unknown): error is FetchError<{ detail: string }> {
  return isFetchError(error) && 'detail' in error.data;
}
