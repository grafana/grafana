import { type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { RadioButtonGroup, Stack } from '@grafana/ui';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { PAGE_HISTORY_KINDS, type PageHistoryKind } from 'app/core/services/pageHistory/types';

import { FooterAction, FooterActions } from '../FooterActions';
import { clearHistoryClicked } from '../analytics/main';

import { type RecentActivity } from './getRecentActivity';

/** `''` is the "All" option: RadioButtonGroup needs a value for it. */
type FilterValue = PageHistoryKind | '';

interface Props {
  counts: RecentActivity['counts'];
  filter: PageHistoryKind | undefined;
  onFilterChange: (filter: PageHistoryKind | undefined) => void;
  retry: () => void;
}

function filterLabel(kind: PageHistoryKind): string {
  switch (kind) {
    case 'dashboard':
      return t('home.recent-activity-tab.filter-dashboards', 'Dashboards');
    case 'explore':
      return t('home.recent-activity-tab.filter-explore', 'Explore');
    case 'alerting':
      return t('home.recent-activity-tab.filter-alerting', 'Alerting');
    case 'app':
      return t('home.recent-activity-tab.filter-apps', 'Apps');
  }
}

/** Kind filter on the left, the clear action on the right; wraps when the card is too narrow for both. */
export function RecentActivityFooter({ counts, filter, onFilterChange, retry }: Props) {
  const total = PAGE_HISTORY_KINDS.reduce((sum, kind) => sum + counts[kind], 0);

  if (total === 0) {
    return null;
  }

  const options: Array<SelectableValue<FilterValue>> = [
    { value: '', label: t('home.recent-activity-tab.filter-all', 'All') },
    ...PAGE_HISTORY_KINDS.map((kind) => ({ value: kind, label: filterLabel(kind) })),
  ];

  const handleClear = async () => {
    clearHistoryClicked({ dashboard_count: counts.dashboard, page_count: total });
    await pageHistorySrv.clear();
    retry();
  };

  return (
    <Stack direction="row" wrap="wrap" alignItems="center" justifyContent="space-between" gap={1}>
      <RadioButtonGroup<FilterValue>
        size="sm"
        aria-label={t('home.recent-activity-tab.filter-label', 'Show only')}
        options={options}
        disabledOptions={PAGE_HISTORY_KINDS.filter((kind) => counts[kind] === 0)}
        value={filter ?? ''}
        onChange={(value) => onFilterChange(value || undefined)}
      />
      <FooterActions>
        <FooterAction onClick={handleClear}>
          <Trans i18nKey="home.recent-activity-tab.clear">Clear recent activity</Trans>
        </FooterAction>
      </FooterActions>
    </Stack>
  );
}
