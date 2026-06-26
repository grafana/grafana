import { useMemo } from 'react';

import { dateTimeFormat, getTimeZone, getTimeZoneInfo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';
import { type OnCallCurrentUserEventsResponse, onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { SummaryCard, SummaryCardMeta, SummaryCardTitle } from './SummaryCard';

const DAY_MS = 24 * 60 * 60 * 1000;
const ON_CALL_SHIFT_DISPLAY_LIMIT = 3;
const ON_CALL_SHIFT_LOOKAHEAD_DAYS = 31;

export function OnCallCard() {
  const { pluginId, installed, loading, settings } = useIrmPlugin(SupportedPlugin.OnCall);

  // Hide the card whenever the OnCall/IRM plugin isn't available — including while the
  // settings probe is in flight, so the card never flashes in before disappearing.
  if (loading || !installed) {
    return null;
  }

  // Gate schedule links like IncidentsCard does: a user without access to the plugin's schedules
  // page sees names as plain text, not links that 403 on click.
  const canAccess = settings ? canAccessPluginPage(settings, createBridgeURL(pluginId, '/schedules')) : false;

  return <OnCallCardInner pluginId={pluginId} canAccess={canAccess} />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function OnCallCardInner({ pluginId, canAccess }: { pluginId: string; canAccess: boolean }) {
  const request = useMemo(() => getCurrentUserEventsRequest(pluginId), [pluginId]);
  const { data, isLoading, error, refetch } = onCallApi.useGetCurrentUserOnCallEventsQuery(request.params);

  const rows = useMemo(() => getShiftRows(data, request.now, request.timeZone), [data, request.now, request.timeZone]);
  const displayed = rows.slice(0, ON_CALL_SHIFT_DISPLAY_LIMIT);

  return (
    <SummaryCard
      title={t('home.oncall-card.title', 'On-call shifts')}
      count={displayed.length}
      countColor="blue"
      loading={isLoading}
      error={
        error
          ? { title: t('home.oncall-card.error-title', 'Could not load on-call shifts'), onRetry: () => refetch() }
          : undefined
      }
      emptyMessage={t('home.oncall-card.empty', 'No upcoming shifts found.')}
      items={displayed}
      getItemKey={(r) => r.key}
      renderItem={(r) => (
        <>
          <SummaryCardTitle href={canAccess ? createBridgeURL(pluginId, `/schedules/${r.scheduleId}`) : undefined}>
            {r.scheduleName}
          </SummaryCardTitle>
          <SummaryCardMeta>{r.timeRange}</SummaryCardMeta>
        </>
      )}
      footer={
        canAccess && (
          <LinkButton variant="secondary" size="sm" fill="text" href={createBridgeURL(pluginId, '/schedules')}>
            {t('home.oncall-card.view-schedules', 'View schedules')}
          </LinkButton>
        )
      }
    />
  );
}

interface OnCallShiftRow {
  key: string;
  scheduleId: string;
  scheduleName: string;
  startMs: number;
  timeRange: string;
}

function getCurrentUserEventsRequest(pluginId: string) {
  const now = Date.now();
  const timeZone = getCurrentUserTimeZone(now);
  const date = dateTimeFormat(now - DAY_MS, { format: 'YYYY-MM-DD', timeZone });

  return {
    now,
    timeZone,
    params: {
      pluginId,
      date,
      days: String(ON_CALL_SHIFT_LOOKAHEAD_DAYS + 2),
      user_tz: timeZone,
    },
  };
}

function getCurrentUserTimeZone(now: number) {
  const timeZone = getTimeZone();
  return getTimeZoneInfo(timeZone, now)?.ianaName || timeZone || 'UTC';
}

function getShiftRows(data: OnCallCurrentUserEventsResponse | undefined, now: number, timeZone: string) {
  const seen = new Set<string>();
  const rows: OnCallShiftRow[] = [];

  for (const schedule of data?.schedules ?? []) {
    for (const event of schedule.events ?? []) {
      if (event.is_gap || event.is_empty || !event.start || !event.end) {
        continue;
      }

      const startMs = Date.parse(event.start);
      const endMs = Date.parse(event.end);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= now) {
        continue;
      }

      const shiftId = event.shift?.pk ?? event.shift?.id ?? 'event';
      const key = `${schedule.id}:${shiftId}:${event.start}:${event.end}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      rows.push({
        key,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        startMs,
        timeRange: formatShiftTimeRange(event.start, event.end, timeZone),
      });
    }
  }

  return rows.sort((a, b) => a.startMs - b.startMs);
}

function formatShiftTimeRange(start: string, end: string, timeZone: string) {
  const startsAndEndsSameDay =
    dateTimeFormat(start, { format: 'YYYY-MM-DD', timeZone }) ===
    dateTimeFormat(end, { format: 'YYYY-MM-DD', timeZone });

  return `${dateTimeFormat(start, { format: 'MMM D, HH:mm', timeZone })} - ${dateTimeFormat(end, {
    format: startsAndEndsSameDay ? 'HH:mm' : 'MMM D, HH:mm',
    timeZone,
  })}`;
}
