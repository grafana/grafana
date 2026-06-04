import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { FolderProgressCard } from './FolderProgressCard';
import { StatCard } from './StatCard';
import { type FolderCounts, type MigrationTotals, percent } from './stats';

interface OverviewStatCardsProps {
  totals: MigrationTotals;
  folderCounts: FolderCounts;
}

export function OverviewStatCards({ totals, folderCounts }: OverviewStatCardsProps) {
  const styles = useStyles2(getStyles);
  const progressSubLabel =
    totals.gitSync > 0
      ? t('provisioning.migrate.progress-gitops-sub', '{{count}} via Git Sync', { count: totals.gitSync })
      : t('provisioning.migrate.progress-gitops-sub-empty', 'Start your migration');
  const dashboardsOf = (value: number) =>
    t('provisioning.migrate.n-of-m-dashboards', '{{value}} of {{count}} dashboards', {
      value,
      count: totals.instanceTotal,
    });
  return (
    <div className={styles.statCardsRow}>
      <StatCard
        icon="apps"
        tone="info"
        big={totals.instanceTotal.toLocaleString()}
        subLabel={t('provisioning.migrate.summary-total-sub', 'Across all providers')}
        label={t('provisioning.migrate.summary-total', 'Dashboards')}
      />
      <StatCard
        icon="check-circle"
        tone="success"
        big={percent(totals.managed, totals.instanceTotal)}
        subLabel={dashboardsOf(totals.managed)}
        label={t('provisioning.migrate.managed', 'Managed dashboards')}
      />
      <StatCard
        icon="exclamation-triangle"
        tone="warning"
        emphasized={totals.unmanaged > 0}
        big={percent(totals.unmanaged, totals.instanceTotal)}
        subLabel={dashboardsOf(totals.unmanaged)}
        label={t('provisioning.migrate.summary-unmanaged', 'Unmanaged dashboards')}
      />
      <StatCard
        icon="chart-line"
        tone="primary"
        big={percent(totals.gitSync, totals.instanceTotal)}
        subLabel={progressSubLabel}
        label={t('provisioning.migrate.progress-gitops', 'Progress to GitOps')}
      />
      <FolderProgressCard managed={folderCounts.managed} total={folderCounts.total} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  statCardsRow: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  }),
});
