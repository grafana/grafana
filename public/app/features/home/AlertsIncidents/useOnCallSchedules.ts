import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';
import { useInterval } from 'react-use';

import { getTimeZone, getTimeZoneInfo } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import {
  onCallApi,
  type OnCallScheduleDTO,
  type OnCallShortUser,
  type OnCallUserScheduleEvents,
} from 'app/features/alerting/unified/api/onCallApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HOME_CARD_MAX_ITEMS } from './constants';
import { type ScheduleLoadError, classifyScheduleError } from './scheduleErrors';
import { type ShiftWindow, dayKey, nextShift } from './shiftTiming';

const PLUGIN_ID = SupportedPlugin.Irm;
const CLOCK_TICK_MS = 60_000;

interface OnCallScheduleRow {
  id: string;
  name: string;
  /** Who is on call right now; the signed-in user first when present. */
  onCallNow: OnCallShortUser[];
  /** Set when the user has a shift on this schedule in the window: the running one, else the next. */
  shift?: ShiftWindow;
}

export interface MyShiftsData {
  /** Undefined while the plugin probe is in flight. */
  enabled: boolean | undefined;
  /** Whether the user may open the plugin's schedules pages; the footer link renders only then. */
  canAccess: boolean;
  schedulesHref: string;
  /** True while one of the user's shifts is running; never derived from stale data after a failed refetch. */
  isOnCall: boolean;
}

export interface OnCallSchedulesData {
  pluginId: SupportedPlugin.Irm;
  /** Whether the user may open the plugin's schedules pages; rows render as plain text otherwise. */
  canAccess: boolean;
  /** The user's schedules first (running shift, then soonest upcoming), then team schedules by name. */
  rows: OnCallScheduleRow[];
  loading: boolean;
  error: ScheduleLoadError | undefined;
  refetch: () => void;
}

/**
 * Wall clock ticking once a minute. A shift can start or end while the homepage sits open; evaluating shifts
 * against this clock moves the badge and labels without a fetch, and at local midnight it loads the next window.
 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
  return now;
}

function useIrmPlugin() {
  const { installed, loading, settings } = usePluginBridge(PLUGIN_ID);
  const schedulesHref = createBridgeURL(PLUGIN_ID, '/schedules');
  return {
    loading,
    // Queries wait for the probe, so the hooks can run before it is known whether IRM is installed.
    ready: !loading && !!installed,
    enabled: loading ? undefined : !!installed,
    schedulesHref,
    // Same gate as incident links: no access to the plugin's schedules page means plain text, not a link that 403s.
    canAccess: settings ? canAccessPluginPage(settings, schedulesHref) : false,
  };
}

// The engine resolves user_tz with pytz, so it needs an IANA name: never 'browser'/'utc'/''.
function resolveUserTimeZone(now: number): string {
  return getTimeZoneInfo(getTimeZone(), now)?.ianaName || getTimeZoneInfo('browser', now)?.ianaName || 'UTC';
}

// Both hooks build their args here so they subscribe to one cache entry.
function currentUserEventsArgs(now: number) {
  return { pluginId: PLUGIN_ID, date: dayKey(now), userTz: resolveUserTimeZone(now) };
}

/** The running or next shift per schedule id; undefined where every shift in the window has ended. */
function toShifts(schedules: OnCallUserScheduleEvents[] | undefined, now: number) {
  return new Map((schedules ?? []).map((schedule) => [schedule.id, nextShift(schedule.events, now)]));
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
 * The header's view of the user's shifts in the next 30 days. Loads with the homepage and never polls on its own;
 * the list's subscription below refreshes the shared cache entry whenever the tab is open.
 */
export function useMyShifts(now: number): MyShiftsData {
  const { ready, enabled, canAccess, schedulesHref } = useIrmPlugin();
  const events = onCallApi.useGetCurrentUserEventsQuery(ready ? currentUserEventsArgs(now) : skipToken, {
    refetchOnMountOrArgChange: true,
  });
  const shifts = useMemo(() => toShifts(events.currentData, now), [events.currentData, now]);
  return {
    enabled,
    canAccess,
    schedulesHref,
    isOnCall: !events.error && [...shifts.values()].some((shift) => shift?.isCurrent),
  };
}

/**
 * Everything the "On call" list shows: the user's shifts and the schedules of the teams those belong to, with who
 * is on call right now. Run it where the list renders: mounting refetches both sources, and while mounted in a
 * focused window they poll at the clock's cadence, so a shift boundary moves the roster along with the user's
 * label. Unmounting stops the polling. Anything cached stays on screen meanwhile.
 */
export function useOnCallSchedules(now: number): OnCallSchedulesData {
  const { loading: pluginLoading, ready, canAccess } = useIrmPlugin();
  const queryOptions = {
    refetchOnMountOrArgChange: true,
    pollingInterval: CLOCK_TICK_MS,
    skipPollingIfUnfocused: true,
  };
  const events = onCallApi.useGetCurrentUserEventsQuery(ready ? currentUserEventsArgs(now) : skipToken, queryOptions);
  const schedules = onCallApi.useGetRelatedSchedulesQuery(ready ? { pluginId: PLUGIN_ID } : skipToken, queryOptions);

  const shifts = useMemo(() => toShifts(events.currentData, now), [events.currentData, now]);
  const rows = useMemo(
    () => toRows(schedules.currentData ?? [], shifts, contextSrv.user.login),
    [schedules.currentData, shifts]
  );

  const error = events.error ?? schedules.error;
  return {
    pluginId: PLUGIN_ID,
    canAccess,
    rows,
    loading: pluginLoading || isPending(events) || isPending(schedules),
    error: error ? classifyScheduleError(error) : undefined,
    // Both queries start together, so either error leaves both refetchable.
    refetch: () => {
      events.refetch();
      schedules.refetch();
    },
  };
}
