import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';
import { useInterval, useUpdateEffect } from 'react-use';

import { dateTimeFormat, getTimeZone, getTimeZoneInfo } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { onCallApi, type OnCallScheduleDTO, type OnCallShortUser } from 'app/features/alerting/unified/api/onCallApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HOME_CARD_MAX_ITEMS } from './constants';
import { type ScheduleLoadError, classifyScheduleError } from './scheduleErrors';
import { type ShiftWindow, nextShift } from './shiftTiming';

interface OnCallScheduleRow {
  id: string;
  name: string;
  /** Who is on call right now; the signed-in user first when present. */
  onCallNow: OnCallShortUser[];
  /** Set when the user has a shift on this schedule in the window: the running one, else the next. */
  shift?: ShiftWindow;
}

export interface OnCallSchedulesData {
  pluginId: SupportedPlugin.Irm;
  /** Whether the user may open the plugin's schedules pages; rows and footer render as plain text otherwise. */
  canAccess: boolean;
  schedulesHref: string;
  /** The instant rows were derived at; shift times format against the same clock. */
  now: number;
  /** The user's schedules first (running shift, then soonest upcoming), then team schedules by name. */
  rows: OnCallScheduleRow[];
  /** True while one of the user's shifts is running; never derived from stale data after a failed refetch. */
  isOnCall: boolean;
  /** Undefined while the plugin probe is in flight. */
  enabled: boolean | undefined;
  loading: boolean;
  error: ScheduleLoadError | undefined;
  refetch: () => void;
}

const CLOCK_TICK_MS = 60_000;

// The engine resolves user_tz with pytz, so it needs an IANA name: never 'browser'/'utc'/''.
function resolveUserTimeZone(now: number): string {
  return getTimeZoneInfo(getTimeZone(), now)?.ianaName || getTimeZoneInfo('browser', now)?.ianaName || 'UTC';
}

/** Schedules with a shift of the user's ahead or someone on call now; the user's shifts lead, then by name. */
function toRows(
  schedules: OnCallScheduleDTO[],
  shifts: Map<string, ShiftWindow | undefined>,
  login: string
): OnCallScheduleRow[] {
  const meFirst = (users: OnCallShortUser[]) =>
    [...users].sort((a, b) => Number(b.username === login) - Number(a.username === login));
  const collator = new Intl.Collator();
  const rank = (row: OnCallScheduleRow) => (row.shift?.isCurrent ? 0 : row.shift ? 1 : 2);
  return schedules
    .flatMap((schedule) => {
      const shift = shifts.get(schedule.id);
      // A schedule whose shift of mine already ended today still matters while someone else is on call.
      return shift || schedule.on_call_now.length > 0
        ? [{ id: schedule.id, name: schedule.name, onCallNow: meFirst(schedule.on_call_now), shift }]
        : [];
    })
    .sort(
      (a, b) => rank(a) - rank(b) || (a.shift?.start ?? 0) - (b.shift?.start ?? 0) || collator.compare(a.name, b.name)
    )
    .slice(0, HOME_CARD_MAX_ITEMS);
}

const isPending = (query: { isFetching: boolean; currentData?: unknown }) =>
  query.isFetching && query.currentData === undefined;

/**
 * Everything the homepage "On call" view shows: the user's own shifts in the next 30 days and the schedules of
 * the teams those belong to, with who is on call right now. The user's shifts load eagerly (the header badge
 * depends on them); the schedule lists load only while `loadRosters` is true, since they can cost several
 * requests per team and most visitors never open the tab.
 *
 * Refresh policy: both sources refetch on homepage mount and each time the tab opens, and while the tab is open
 * in a focused window they poll at the clock's cadence, so a shift boundary moves the roster along with the
 * user's label. Anything cached stays on screen meanwhile. With the tab closed only the clock moves: the badge
 * follows it, and at local midnight it refetches the next window.
 */
export function useOnCallSchedules({ loadRosters }: { loadRosters: boolean }): OnCallSchedulesData {
  const { installed, loading: pluginLoading, settings } = usePluginBridge(SupportedPlugin.Irm);
  const pluginId = SupportedPlugin.Irm;
  const schedulesHref = createBridgeURL(pluginId, '/schedules');
  // Same gate as incident links: no access to the plugin's schedules page means plain text, not a link that 403s.
  const canAccess = settings ? canAccessPluginPage(settings, schedulesHref) : false;

  // A shift can start or end while the homepage sits open; the minute tick re-derives rows and badge,
  // and at local midnight it changes `date`, which refetches the next window.
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
  // Polling only while the tab shows the data: a background homepage shouldn't cost the engine a request a minute.
  const queryOptions = {
    refetchOnMountOrArgChange: true,
    pollingInterval: loadRosters ? CLOCK_TICK_MS : 0,
    skipPollingIfUnfocused: true,
  };

  const ready = !pluginLoading && !!installed;
  const userTz = resolveUserTimeZone(now);
  const date = dateTimeFormat(now, { format: 'YYYY-MM-DD' });
  const events = onCallApi.useGetCurrentUserEventsQuery(ready ? { pluginId, date, userTz } : skipToken, queryOptions);
  const schedules = onCallApi.useGetRelatedSchedulesQuery(
    ready && loadRosters ? { pluginId } : skipToken,
    queryOptions
  );
  // The rosters refetch on their own when the tab opens (their args go from skipped to set); the shifts need a
  // nudge, or a roster fetched now could contradict a shift fetched at page load after an override or a swap.
  useUpdateEffect(() => {
    if (loadRosters && !events.isUninitialized) {
      events.refetch();
    }
  }, [loadRosters]);

  const shifts = useMemo(
    () => new Map((events.currentData ?? []).map((schedule) => [schedule.id, nextShift(schedule.events, now)])),
    [events.currentData, now]
  );
  const rows = useMemo(
    () => toRows(schedules.currentData ?? [], shifts, contextSrv.user.login),
    [schedules.currentData, shifts]
  );

  const error = events.error ?? schedules.error;
  return {
    pluginId,
    canAccess,
    schedulesHref,
    now,
    rows,
    isOnCall: !events.error && [...shifts.values()].some((shift) => shift?.isCurrent),
    enabled: pluginLoading ? undefined : !!installed,
    loading: pluginLoading || isPending(events) || isPending(schedules),
    error: error ? classifyScheduleError(error) : undefined,
    refetch: () => {
      for (const query of [events, schedules]) {
        if (query.error) {
          query.refetch();
        }
      }
    },
  };
}
