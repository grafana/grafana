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
// The clock moves labels and badge across shift boundaries without a fetch; the poll picks up overrides,
// swaps and roster changes. Each list page makes the engine resolve who is on call for 100 schedules.
const CLOCK_TICK_MS = 60_000;
const POLL_INTERVAL_MS = 15 * 60_000;

interface OnCallScheduleRow {
  id: string;
  name: string;
  /** Who is on call right now; the signed-in user first when present. */
  onCallNow: OnCallShortUser[];
  /** Set when the user has a shift on this schedule in the window: the running one, else the next. */
  shift?: ShiftWindow;
}

export interface MyShiftsData {
  /** The instant the badge was evaluated at; the list formats its shifts against the same clock. */
  now: number;
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

/** Every subscription refetches on mount so a revisit shows fresh data; polling, where asked for, pauses unfocused. */
function subscription(pollingInterval = 0) {
  return { refetchOnMountOrArgChange: true, pollingInterval, skipPollingIfUnfocused: true };
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
 * The IRM probe and the user's shifts in the window, evaluated against `now`. Both exported hooks subscribe
 * through here, so they share one cache entry and a refetch by either refreshes the other. The window starts
 * on the user's current day, so the clock crossing local midnight loads the next one.
 */
function useShifts(now: number, pollingInterval?: number) {
  const plugin = useIrmPlugin();
  const events = onCallApi.useGetCurrentUserEventsQuery(
    plugin.ready ? { pluginId: PLUGIN_ID, date: dayKey(now), userTz: resolveUserTimeZone(now) } : skipToken,
    subscription(pollingInterval)
  );
  const shifts = useMemo(() => toShifts(events.currentData, now), [events.currentData, now]);
  return { plugin, events, shifts };
}

/**
 * The header's view: whether one of the user's shifts is running right now, on a clock that ticks once a minute
 * so the badge follows shift boundaries without a fetch. Loads with the homepage and never polls on its own;
 * the list's subscription refreshes the shared cache entry while the tab is open.
 */
export function useMyShifts(): MyShiftsData {
  const [now, setNow] = useState(() => Date.now());
  const { plugin, events, shifts } = useShifts(now);
  // Nothing reads the clock until IRM is confirmed installed, so don't re-render the card for anyone else.
  useInterval(() => setNow(Date.now()), plugin.ready ? CLOCK_TICK_MS : null);
  return {
    now,
    enabled: plugin.enabled,
    canAccess: plugin.canAccess,
    schedulesHref: plugin.schedulesHref,
    isOnCall: !events.error && [...shifts.values()].some((shift) => shift?.isCurrent),
  };
}

/**
 * Everything the "On call" list shows: the user's shifts and the schedules of the teams those belong to, with who
 * is on call right now. Run it where the list renders: mounting refetches both sources, and while mounted in a
 * focused window they poll every 15 minutes. Unmounting stops the polling. Anything cached stays on screen
 * meanwhile.
 */
export function useOnCallSchedules(now: number): OnCallSchedulesData {
  const { plugin, events, shifts } = useShifts(now, POLL_INTERVAL_MS);
  const schedules = onCallApi.useGetRelatedSchedulesQuery(
    plugin.ready ? { pluginId: PLUGIN_ID } : skipToken,
    subscription(POLL_INTERVAL_MS)
  );
  const rows = useMemo(
    () => toRows(schedules.currentData ?? [], shifts, contextSrv.user.login),
    [schedules.currentData, shifts]
  );

  const error = events.error ?? schedules.error;
  return {
    pluginId: PLUGIN_ID,
    canAccess: plugin.canAccess,
    rows,
    loading: plugin.loading || isPending(events) || isPending(schedules),
    error: error ? classifyScheduleError(error) : undefined,
    // Both queries start together, so either error leaves both refetchable.
    refetch: () => {
      events.refetch();
      schedules.refetch();
    },
  };
}
