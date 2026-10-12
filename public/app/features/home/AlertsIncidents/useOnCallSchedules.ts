import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';
import { useInterval } from 'react-use';

import { dateTimeFormat, getTimeZone, getTimeZoneInfo } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import {
  onCallApi,
  type OnCallScheduleDTO,
  type OnCallScheduleEvent,
  type OnCallShortUser,
  type UserScheduleShifts,
} from 'app/features/alerting/unified/api/onCallApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HOME_CARD_MAX_ITEMS } from './constants';
import { type ScheduleLoadError, classifyScheduleError } from './scheduleErrors';
import { type ShiftWindow } from './shiftTiming';

export interface OnCallScheduleRow {
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
  /** The user's schedules first (running shift, then soonest upcoming), then team schedules by name. */
  rows: OnCallScheduleRow[];
  /** True while one of the user's shifts is running; never derived from stale rows after a failed refetch. */
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

/** The running shift, else the next one to start; undefined when every shift in the window has ended. */
function nextShift(events: OnCallScheduleEvent[], now: number): ShiftWindow | undefined {
  // The window starts at local midnight, so shifts that ended earlier today come back too.
  const remaining = events
    .map((event) => ({ start: Date.parse(event.start), end: Date.parse(event.end) }))
    .filter((event) => event.end > now)
    .sort((a, b) => a.start - b.start);
  const next = remaining[0];
  return next && { ...next, isCurrent: next.start <= now };
}

function toRows(
  mine: UserScheduleShifts[],
  teams: OnCallScheduleDTO[],
  now: number,
  login: string
): OnCallScheduleRow[] {
  const meFirst = (users: OnCallShortUser[]) =>
    [...users].sort((a, b) => Number(b.username === login) - Number(a.username === login));
  const rows: OnCallScheduleRow[] = [];
  const seen = new Set<string>();
  for (const schedule of mine) {
    seen.add(schedule.id);
    const shift = nextShift(schedule.events, now);
    // A schedule whose shift of mine already ended today still matters while someone else is on call.
    if (shift || schedule.onCallNow.length > 0) {
      rows.push({ id: schedule.id, name: schedule.name, onCallNow: meFirst(schedule.onCallNow), shift });
    }
  }
  for (const schedule of teams) {
    if (seen.has(schedule.id)) {
      continue;
    }
    seen.add(schedule.id);
    if (schedule.on_call_now.length > 0) {
      rows.push({ id: schedule.id, name: schedule.name, onCallNow: meFirst(schedule.on_call_now) });
    }
  }
  const collator = new Intl.Collator();
  const rank = (row: OnCallScheduleRow) => (row.shift?.isCurrent ? 0 : row.shift ? 1 : 2);
  return rows
    .sort(
      (a, b) => rank(a) - rank(b) || (a.shift?.start ?? 0) - (b.shift?.start ?? 0) || collator.compare(a.name, b.name)
    )
    .slice(0, HOME_CARD_MAX_ITEMS);
}

/**
 * Everything the homepage "On call" view shows: the user's own shifts in the next 30 days and the schedules of
 * the teams those belong to, with who is on call right now. The user's shifts load eagerly (the header badge
 * depends on them); team schedules load only while `skip` is false, since they can cost several requests per
 * team and most visitors never open the tab. Every opening refetches while any cached roster stays on screen.
 */
export function useOnCallSchedules({ skip }: { skip: boolean }): OnCallSchedulesData {
  const { installed, loading: pluginLoading, settings } = usePluginBridge(SupportedPlugin.Irm);
  const pluginId = SupportedPlugin.Irm;
  const schedulesHref = createBridgeURL(pluginId, '/schedules');
  // Same gate as incident links: no access to the plugin's schedules page means plain text, not a link that 403s.
  const canAccess = settings ? canAccessPluginPage(settings, schedulesHref) : false;

  // A shift can start or end while the homepage sits open; the minute tick re-derives rows and badge,
  // and at local midnight it changes `date`, which refetches the next window.
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  const userTz = resolveUserTimeZone(now);
  const date = dateTimeFormat(now, { format: 'YYYY-MM-DD' });
  const shifts = onCallApi.useGetCurrentUserShiftsQuery(
    pluginLoading || !installed ? skipToken : { pluginId, date, userTz },
    { refetchOnMountOrArgChange: true }
  );
  const shiftsLoading = pluginLoading || (shifts.isFetching && shifts.currentData === undefined);
  const shiftsError = shifts.error ? classifyScheduleError(shifts.error) : undefined;

  // Team discovery uses every schedule the window reported, past-only ones included.
  const teamIds = useMemo(
    () => [...new Set((shifts.currentData ?? []).flatMap((s) => (s.team ? [s.team] : [])))].sort(),
    [shifts.currentData]
  );
  const loadTeams = !skip && !shiftsLoading && !shiftsError && teamIds.length > 0;
  const teams = onCallApi.useGetTeamSchedulesQuery(loadTeams ? { pluginId, teamIds } : skipToken, {
    refetchOnMountOrArgChange: true,
  });
  // Until the first team page lands (or fails) the list would be missing half its rows.
  const teamsLoading = loadTeams && teams.currentData === undefined && !teams.error;

  const rows = useMemo(
    () => toRows(shifts.currentData ?? [], teams.currentData ?? [], now, contextSrv.user.login),
    [shifts.currentData, teams.currentData, now]
  );

  return {
    pluginId,
    canAccess,
    schedulesHref,
    rows,
    isOnCall: !shiftsError && rows.some((row) => row.shift?.isCurrent),
    enabled: pluginLoading ? undefined : !!installed,
    loading: shiftsLoading || teamsLoading,
    // The team list derives from the user's schedules, so their failure is the whole view's failure.
    error: shiftsError ?? (teams.error ? classifyScheduleError(teams.error) : undefined),
    refetch: shiftsError ? shifts.refetch : teams.refetch,
  };
}
