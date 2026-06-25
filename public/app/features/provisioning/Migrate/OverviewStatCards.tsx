import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { ResourceStatusCard } from './ResourceStatusCard';
import { kindPluralLabel } from './hooks/migrationSources';
import { type KindTotals } from './stats';

interface OverviewStatCardsProps {
  /**
   * Per-kind totals, one entry per active migratable kind. Cards render
   * generically from this, so a newly enabled kind shows up without changes
   * here. A card with no resources self-hides (see ResourceStatusCard).
   */
  totals: KindTotals[];
}

/**
 * The migration objective is zero unmanaged resources. The overview reports how
 * much of each migratable kind is already managed, one card per kind. When more
 * than one kind actually has resources, a combined "All resources" card
 * summarizes the total progress.
 */
export function OverviewStatCards({ totals }: OverviewStatCardsProps) {
  const styles = useStyles2(getStyles);

  // Only kinds that actually have resources count toward the combined card —
  // and it's only worth showing when more than one does, otherwise it just
  // duplicates the single populated card.
  const populated = totals.filter((t) => t.totals.instanceTotal > 0);
  const combined =
    populated.length > 1
      ? populated.reduce(
          (acc, { totals }) => ({
            managed: acc.managed + totals.managed,
            instanceTotal: acc.instanceTotal + totals.instanceTotal,
          }),
          { managed: 0, instanceTotal: 0 }
        )
      : undefined;

  return (
    <div className={styles.statCardsRow}>
      {totals.map(({ kind, totals }) => (
        <ResourceStatusCard
          key={`${kind.group}/${kind.kind}`}
          label={kindPluralLabel(kind)}
          managed={totals.managed}
          total={totals.instanceTotal}
        />
      ))}
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
