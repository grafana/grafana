import { type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, RadioButtonGroup, Stack } from '@grafana/ui';

import { FooterAction, FooterActions } from '../FooterActions';
import { clearHistoryClicked, recentActivityFilterChanged } from '../analytics/main';

import { PAGE_KINDS, type PageKindCounts, getPageKindMeta } from './pageKinds';
import { type RecentActivityFilter } from './useRecentActivity';

interface Props {
  counts: PageKindCounts;
  total: number;
  filter: RecentActivityFilter;
  onFilterChange: (filter: RecentActivityFilter) => void;
  onClear: () => void;
}

/**
 * The clear action on the right and, when the history holds more than one kind of page, a filter over
 * those kinds on the left; wraps when the card is too narrow for both.
 */
export function RecentActivityFooter({ counts, total, filter, onFilterChange, onClear }: Props) {
  const kinds = PAGE_KINDS.filter((kind) => counts[kind] > 0);

  const handleClear = () => {
    clearHistoryClicked({ dashboard_count: counts.dashboard, page_count: total });
    onClear();
  };

  const handleFilterChange = (filter: RecentActivityFilter) => {
    recentActivityFilterChanged({ filter: filter || 'all' });
    onFilterChange(filter);
  };

  const clear = (
    <FooterActions>
      <FooterAction onClick={handleClear}>
        <Trans i18nKey="home.recent-activity-tab.clear">Clear recent activity</Trans>
      </FooterAction>
    </FooterActions>
  );

  if (kinds.length < 2) {
    return (
      <Box padding={1} paddingTop={1.5}>
        {clear}
      </Box>
    );
  }

  const options: Array<SelectableValue<RecentActivityFilter>> = [
    { value: '', label: t('home.recent-activity-tab.filter-all', 'All') },
    ...kinds.map((kind) => ({ value: kind, label: getPageKindMeta(kind).filterLabel })),
  ];

  return (
    <Box padding={1} paddingTop={1.5}>
      <Stack direction="row" wrap="wrap" alignItems="center" justifyContent="space-between" gap={1}>
        <RadioButtonGroup<RecentActivityFilter>
          size="sm"
          aria-label={t('home.recent-activity-tab.filter-label', 'Show only')}
          options={options}
          value={filter}
          onChange={handleFilterChange}
        />
        {clear}
      </Stack>
    </Box>
  );
}
