import { http, HttpResponse } from 'msw';

import server from '@grafana/test-utils/server';
import {
  type CurrentUserEventsResponse,
  type OnCallScheduleDTO,
  type OnCallScheduleEvent,
  type OnCallShortUser,
  SCHEDULE_PAGE_SIZE,
} from 'app/features/alerting/unified/api/onCallApi';

// Trailing slashes match getProxyApiUrl('/schedules/') exactly.
const CURRENT_USER_EVENTS_PATH = '/api/plugins/:pluginId/resources/schedules/current_user_events/';
const SCHEDULES_PATH = '/api/plugins/:pluginId/resources/schedules/';

export const me: OnCallShortUser = {
  pk: 'U1',
  username: 'admin',
  avatar: '/avatar/me',
  avatar_full: 'https://stack/avatar/me',
};
export const bob: OnCallShortUser = {
  pk: 'U2',
  username: 'bob',
  avatar: '/avatar/bob',
  avatar_full: 'https://stack/avatar/bob',
};
export const carol: OnCallShortUser = {
  pk: 'U3',
  username: 'carol',
  avatar: '/avatar/carol',
  avatar_full: 'https://stack/avatar/carol',
};

/** One of the user's own shifts as `current_user_events` reports it. */
export function shiftEvent({
  start,
  end,
  users = [me],
}: {
  start: string;
  end: string;
  users?: OnCallShortUser[];
}): OnCallScheduleEvent {
  return {
    start,
    end,
    all_day: false,
    users: users.map((u) => ({
      pk: u.pk,
      display_name: u.username,
      email: `${u.username}@example.com`,
      avatar_full: u.avatar_full,
    })),
  };
}

/** Answers the shift-events request; returns the query params (`date`, `days`, `user_tz`) of each call. */
export function mockCurrentUserEvents(response: CurrentUserEventsResponse): URLSearchParams[] {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(CURRENT_USER_EVENTS_PATH, ({ request }) => {
      calls.push(new URL(request.url).searchParams);
      return HttpResponse.json(response);
    })
  );
  return calls;
}

export function mockCurrentUserEventsError(status: number) {
  server.use(http.get(CURRENT_USER_EVENTS_PATH, () => HttpResponse.json({ detail: 'error' }, { status })));
}

export interface ScheduleListCall {
  /** `'mine'` or `team:<id>`. */
  filter: string;
  page: number;
}

function listFilter(params: URLSearchParams): string {
  const team = params.get('team');
  return team !== null ? `team:${team}` : 'mine';
}

/**
 * Answers the schedule list. `?mine=true` serves `mine`; `?team=<id>` serves `byTeam[id]` (missing team → []).
 * Pages are sliced at `perpage`; `totalPages` (default: computed) lets a test claim more pages than the data holds.
 * Returns `{ filter, page }` per call.
 */
export function mockSchedules({
  mine = [],
  byTeam = {},
  totalPages,
}: {
  mine?: OnCallScheduleDTO[];
  byTeam?: Record<string, OnCallScheduleDTO[]>;
  totalPages?: number;
}): ScheduleListCall[] {
  const calls: ScheduleListCall[] = [];
  server.use(
    http.get(SCHEDULES_PATH, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get('page') ?? 1);
      const perpage = Number(params.get('perpage') ?? SCHEDULE_PAGE_SIZE);
      calls.push({ filter: listFilter(params), page });
      const team = params.get('team');
      const all = team !== null ? (byTeam[team] ?? []) : mine;
      return HttpResponse.json({
        count: all.length,
        next: null,
        previous: null,
        results: all.slice((page - 1) * perpage, page * perpage),
        page_size: perpage,
        current_page_number: page,
        total_pages: totalPages ?? Math.max(1, Math.ceil(all.length / perpage)),
      });
    })
  );
  return calls;
}

/** Fails every list request, or only those matching `filter` (`'mine'` | `team:<id>`) when given. */
export function mockSchedulesError(status: number, filter?: string) {
  server.use(
    http.get(SCHEDULES_PATH, ({ request }) => {
      if (filter !== undefined && listFilter(new URL(request.url).searchParams) !== filter) {
        // No response: MSW falls through to the next matching handler.
        return undefined;
      }
      return HttpResponse.json({ detail: 'error' }, { status });
    })
  );
}
