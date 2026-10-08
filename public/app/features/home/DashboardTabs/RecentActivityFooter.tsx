import { type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, RadioButtonGroup, Stack } from '@grafana/ui';

import { FooterAction, FooterActions } from '../FooterActions';
import { clearHistoryClicked } from '../analytics/main';

import { PAGE_KINDS, type PageKindCounts, getPageKindMeta } from './pageKinds';
import { type RecentActivityFilter } from './useRecentActivity';

interface Props {
  counts: PageKindCounts;
  filter: RecentActivityFilter;
  onFilterChange: (filter: RecentActivityFilter) => void;
  onClear: () => void;
}

/** Kind filter on the left, the clear action on the right; wraps when the card is too narrow for both. */
export function RecentActivityFooter({ counts, filter, onFilterChange, onClear }: Props) {
  const options: Array<SelectableValue<RecentActivityFilter>> = [
    { value: '', label: t('home.recent-activity-tab.filter-all', 'All') },
    ...PAGE_KINDS.map((kind) => ({ value: kind, label: getPageKindMeta(kind).filterLabel })),
  ];

  const handleClear = () => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    clearHistoryClicked({ dashboard_count: counts.dashboard, page_count: total });
    onClear();
  };

  return (
    <Box padding={1} paddingTop={1.5}>
      <Stack direction="row" wrap="wrap" alignItems="center" justifyContent="space-between" gap={1}>
        <RadioButtonGroup<RecentActivityFilter>
          size="sm"
          aria-label={t('home.recent-activity-tab.filter-label', 'Show only')}
          options={options}
          disabledOptions={PAGE_KINDS.filter((kind) => counts[kind] === 0)}
          value={filter}
          onChange={onFilterChange}
        />
        <FooterActions>
          <FooterAction onClick={handleClear}>
            <Trans i18nKey="home.recent-activity-tab.clear">Clear recent activity</Trans>
          </FooterAction>
        </FooterActions>
      </Stack>
    </Box>
  );
}
