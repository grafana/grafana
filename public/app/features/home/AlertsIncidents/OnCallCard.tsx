import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Text, type UserView, UsersIndicator, useStyles2 } from '@grafana/ui';
import { type OnCallShortUser, SHIFTS_LOOKAHEAD_DAYS } from 'app/features/alerting/unified/api/onCallApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { FooterAction } from '../FooterActions';
import { ctaClicked } from '../analytics/main';

import { SummaryCard } from './SummaryCard';
import { scheduleErrorTitle } from './scheduleErrors';
import { formatShiftTiming } from './shiftTiming';
import { useOnCallSchedules } from './useOnCallSchedules';

const MAX_AVATARS = 3;

/** The "On call" list. Mounting it starts the schedule requests, so they cost nothing while another tab is open. */
export function OnCallCard({ now }: { now: number }) {
  const { pluginId, canAccess, rows, loading, error, refetch } = useOnCallSchedules(now);

  return (
    <SummaryCard
      loading={loading}
      error={error ? { title: scheduleErrorTitle(error), onRetry: () => refetch() } : undefined}
      // Team schedules only earn a row while someone is on call, so the copy can't promise their next 30 days.
      emptyMessage={t(
        'home.on-call-card.empty',
        'You have no shifts in the next {{days}} days, and nobody on your teams is on call right now.',
        { days: SHIFTS_LOOKAHEAD_DAYS }
      )}
      items={rows}
      getItemKey={(row) => row.id}
      renderItem={(row) => (
        <ListRow
          isCompact
          title={row.name}
          subtitle={
            row.shift && (
              // Green only while the user's own shift is running: the row-level counterpart of the header badge.
              <Text color={row.shift.isCurrent ? 'success' : undefined}>{formatShiftTiming(row.shift, now)}</Text>
            )
          }
          trailing={row.onCallNow && <OnCallNowChip users={row.onCallNow} />}
          href={canAccess && row.onCallNow ? createBridgeURL(pluginId, `/schedules/${row.id}`) : undefined}
          onClick={() =>
            ctaClicked({
              surface: 'oncall_card',
              action: row.shift ? 'my_shift_detail' : 'team_schedule_detail',
              placement: 'list',
            })
          }
        />
      )}
    />
  );
}

/** The tab's footer action; the tabs component lays it out. */
export function ViewSchedulesAction({ href }: { href: string }) {
  return (
    <FooterAction
      href={href}
      onClick={() => ctaClicked({ surface: 'oncall_card', action: 'view_schedules', placement: 'footer' })}
    >
      <Trans i18nKey="home.on-call-card.view-schedules">View schedules</Trans>
    </FooterAction>
  );
}

/** Who is on call right now: the first person's login, then avatars collapsing past three (login in the tooltip). */
function OnCallNowChip({ users }: { users: OnCallShortUser[] }) {
  const styles = useStyles2(getStyles);
  if (users.length === 0) {
    return (
      <Text variant="bodySmall" color="secondary">
        {t('home.on-call-card.nobody-on-call', 'Nobody on call')}
      </Text>
    );
  }
  // `avatar` is Grafana's own relative /avatar/<hash> URL; `avatar_full` is pinned to the engine's idea of the stack host.
  const views: UserView[] = users.map((u) => ({ user: { name: u.username, avatarUrl: u.avatar || undefined } }));

  return (
    <div className={styles.chip}>
      <div className={styles.chipLabel}>
        <Text variant="bodySmall" truncate element="p">
          {users[0].username}
        </Text>
      </div>
      <UsersIndicator users={views} limit={MAX_AVATARS} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Caps the chip so a long login truncates instead of squeezing the schedule name out.
  chip: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    maxWidth: 180,
  }),
  // A flex item only shrinks below its text once min-width stops being `auto`; the block inside then truncates.
  chipLabel: css({
    minWidth: 0,
  }),
});
