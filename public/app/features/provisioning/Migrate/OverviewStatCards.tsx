import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { ResourceStatusCard } from './ResourceStatusCard';
import { type MigrationTotals } from './stats';

interface OverviewStatCardsProps {
  dashboards: MigrationTotals;
  /**
   * Playlist totals, present only when the playlist kind is enabled for
   * provisioning on this instance. When omitted, the overview stays
   * dashboard-only and the combined "All resources" card is hidden (it would
   * just duplicate the dashboards card).
   */
  playlists?: MigrationTotals;
}

/**
 * The migration objective is zero unmanaged resources. The overview reports how
 * much of each migratable resource type is already managed. When more than one
 * type is enabled (e.g. dashboards + playlists), a combined "All resources" card
 * summarizes the total progress.
 */
export function OverviewStatCards({ dashboards, playlists }: OverviewStatCardsProps) {
  const styles = useStyles2(getStyles);
  // Only worth a combined card when more than one kind actually has resources —
  // otherwise it just duplicates the single populated card.
  const combined: MigrationTotals | undefined =
    playlists && dashboards.instanceTotal > 0 && playlists.instanceTotal > 0
      ? {
          managed: dashboards.managed + playlists.managed,
          instanceTotal: dashboards.instanceTotal + playlists.instanceTotal,
        }
      : undefined;

  return (
    <div className={styles.statCardsRow}>
      <ResourceStatusCard
        label={t('provisioning.migrate.dashboards', 'Dashboards')}
        managed={dashboards.managed}
        total={dashboards.instanceTotal}
      />
      {playlists && (
        <ResourceStatusCard
          label={t('provisioning.migrate.playlists', 'Playlists')}
          managed={playlists.managed}
          total={playlists.instanceTotal}
        />
      )}
      {combined && (
        <ResourceStatusCard
          label={t('provisioning.migrate.all-resources', 'All resources')}
          managed={combined.managed}
          total={combined.instanceTotal}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  statCardsRow: css({
    display: 'grid',
    // Cap each card's width and left-align the group rather than stretching the
    // cards edge-to-edge. auto-fit collapses the empty tracks so the row stays
    // responsive and wraps on narrow viewports.
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 240px))',
    justifyContent: 'start',
    alignItems: 'start',
    gap: theme.spacing(1.5),
  }),
});
