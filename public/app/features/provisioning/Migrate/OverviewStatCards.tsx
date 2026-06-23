import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { ResourceStatusCard } from './ResourceStatusCard';
import { type MigrationTotals } from './stats';

interface OverviewStatCardsProps {
  totals: MigrationTotals;
}

/**
 * The migration is dashboard-centric: the objective is zero dashboards not
 * managed by Git. So the overview reports how much of the dashboards are
 * managed; folder and combined totals aren't the goal and are left off for now.
 */
export function OverviewStatCards({ totals }: OverviewStatCardsProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.statCardsRow}>
      <ResourceStatusCard
        label={t('provisioning.migrate.dashboards', 'Dashboards')}
        managed={totals.managed}
        total={totals.instanceTotal}
      />
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
