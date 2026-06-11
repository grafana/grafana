import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { ResourceStatusCard } from './ResourceStatusCard';
import { type FolderCounts, type MigrationTotals } from './stats';

interface OverviewStatCardsProps {
  totals: MigrationTotals;
  folderCounts: FolderCounts;
}

export function OverviewStatCards({ totals, folderCounts }: OverviewStatCardsProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.statCardsRow}>
      <ResourceStatusCard
        label={t('provisioning.migrate.dashboards', 'Dashboards')}
        managed={totals.managed}
        total={totals.instanceTotal}
      />
      <ResourceStatusCard
        label={t('provisioning.migrate.folders', 'Folders')}
        managed={folderCounts.managed}
        total={folderCounts.total}
      />
      <ResourceStatusCard
        label={t('provisioning.migrate.all-resources', 'All resources')}
        managed={totals.managed + folderCounts.managed}
        total={totals.instanceTotal + folderCounts.total}
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
