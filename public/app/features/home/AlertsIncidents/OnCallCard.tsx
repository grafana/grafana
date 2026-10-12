import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, type UserView, UsersIndicator, useStyles2 } from '@grafana/ui';
import { type OnCallShortUser } from 'app/features/alerting/unified/api/onCallApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { ctaClicked } from '../analytics/main';

import { SummaryCard } from './SummaryCard';
import { scheduleErrorTitle } from './scheduleErrors';
import { formatShiftTiming } from './shiftTiming';
import { type OnCallSchedulesData } from './useOnCallSchedules';

const MAX_AVATARS = 3;

/** Render-only card body; data comes from useOnCallSchedules so callers control where the hook runs. */
export function OnCallCard({ data }: { data: OnCallSchedulesData }) {
  const { pluginId, canAccess, rows, loading, error, refetch } = data;

  return (
    <SummaryCard
      title={t('home.on-call-card.title', 'On call schedules')}
      loading={loading}
      error={error ? { title: scheduleErrorTitle(error), onRetry: () => refetch() } : undefined}
      emptyMessage={t('home.on-call-card.empty', 'No on-call shifts for you or your teams in the next 30 days.')}
      items={rows}
      getItemKey={(row) => row.id}
      renderItem={(row) => (
        <ListRow
          isCompact
          title={row.name}
          subtitle={row.shift && formatShiftTiming(row.shift)}
          // Green only while the user's own shift is running: the row-level counterpart of the header badge.
          subtitleColor={row.shift?.isCurrent ? 'success' : undefined}
          trailing={<OnCallNowChip users={row.onCallNow} />}
          href={canAccess ? createBridgeURL(pluginId, `/schedules/${row.id}`) : undefined}
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

/** Who is on call right now: the first person's name, then up to three avatars (full login in the tooltip). */
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
  const views: UserView[] = users
    .slice(0, MAX_AVATARS)
    .map((u) => ({ user: { name: u.username, avatarUrl: u.avatar || undefined } }));
  const [first, ...rest] = users;
  // Logins are emails on SSO stacks; the local part is what fits next to the avatar.
  const firstName = first.username.split('@')[0];
  // Same wording for any number of extra people, so the variable is not `count` (which would demand plural forms).
  const label =
    rest.length > 0
      ? t('home.on-call-card.on-call-now-more', '{{name}} +{{more}}', { name: firstName, more: rest.length })
      : firstName;

  return (
    <div className={styles.chip}>
      <div className={styles.chipLabel}>
        <Text variant="bodySmall" truncate element="p">
          {label}
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
