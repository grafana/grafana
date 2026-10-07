import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Stack, useStyles2 } from '@grafana/ui';
import impressionSrv from 'app/core/services/impression_srv';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';

import { FooterAction, FooterActions } from '../FooterActions';
import { clearHistoryClicked } from '../analytics/main';

import { ACTIVITY_FILTERS, type ActivityFilter, type RecentActivity } from './getRecentActivity';

interface Props {
  counts: RecentActivity['counts'];
  filter: ActivityFilter | undefined;
  onFilterChange: (filter: ActivityFilter | undefined) => void;
  retry: () => void;
}

function filterLabel(filter: ActivityFilter): string {
  switch (filter) {
    case 'dashboards':
      return t('home.recent-activity-tab.filter-dashboards', 'Dashboards');
    case 'explore':
      return t('home.recent-activity-tab.filter-explore', 'Explore');
    case 'alerting':
      return t('home.recent-activity-tab.filter-alerting', 'Alerting');
    case 'apps':
      return t('home.recent-activity-tab.filter-apps', 'Apps');
  }
}

/** Kind chips on the left, the clear action on the right; wraps when the card is too narrow for both. */
export function RecentActivityFooter({ counts, filter, onFilterChange, retry }: Props) {
  const styles = useStyles2(getStyles);
  const total = ACTIVITY_FILTERS.reduce((sum, id) => sum + counts[id], 0);

  if (total === 0) {
    return null;
  }

  const handleClear = async () => {
    clearHistoryClicked({ dashboard_count: counts.dashboards, page_count: total });
    // The tab also backfills dashboards from the recently-viewed list, so clearing covers both.
    impressionSrv.clearImpressions();
    await pageHistorySrv.clear();
    retry();
  };

  return (
    <Stack direction="row" wrap="wrap" alignItems="center" justifyContent="space-between" gap={1}>
      <div role="group" aria-label={t('home.recent-activity-tab.filter-label', 'Show only')} className={styles.chips}>
        <button
          type="button"
          aria-pressed={!filter}
          className={cx(styles.chip, !filter && styles.selected)}
          onClick={() => onFilterChange(undefined)}
        >
          <Trans i18nKey="home.recent-activity-tab.filter-all">All</Trans>
        </button>
        {ACTIVITY_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            disabled={counts[id] === 0}
            className={cx(styles.chip, filter === id && styles.selected)}
            onClick={() => onFilterChange(id)}
          >
            {filterLabel(id)}
          </button>
        ))}
      </div>
      <FooterActions>
        <FooterAction onClick={handleClear}>
          <Trans i18nKey="home.recent-activity-tab.clear">Clear recent activity</Trans>
        </FooterAction>
      </FooterActions>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  chips: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  }),
  // Footer-sized: the FilterPill component is 32px tall and would grow the card.
  chip: css({
    ...theme.typography.sm,
    appearance: 'none',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: theme.shape.radius.pill,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    height: theme.spacing(2.5),
    padding: theme.spacing(0, 1),
    whiteSpace: 'nowrap',

    '&:hover:not(:disabled)': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:disabled': {
      color: theme.colors.text.disabled,
      cursor: 'not-allowed',
    },
  }),
  selected: css({
    '&&': {
      background: theme.colors.action.selected,
      borderColor: theme.colors.action.selectedBorder,
      color: theme.colors.text.primary,
    },
  }),
});
