import { t, Trans } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';

import { CardFooter, FooterAction, FooterFilterCombobox } from '../FooterActions';
import { clearHistoryClicked, recentActivityFilterChanged } from '../analytics/main';

import { getPageKindMeta } from './recentActivityRows';
import { type RecentActivity, type RecentActivityFilter } from './useRecentActivity';

interface Props {
  recent: RecentActivity;
}

/**
 * The clear action on the right and, when the history holds more than one kind of page, a filter over
 * those kinds on the left.
 */
export function RecentActivityFooter({ recent }: Props) {
  const { kinds, counts, total, filter, setFilter, clear } = recent;
  const allLabel = t('home.recent-activity-tab.filter-all', 'All');
  // Each kind carries its icon so the closed dropdown shows the picked kind the way its rows do.
  const options: Array<ComboboxOption<RecentActivityFilter>> = [
    { value: 'all', label: allLabel },
    ...kinds.map((kind) => {
      const { filterLabel, icon } = getPageKindMeta(kind);
      return { value: kind, label: filterLabel, icon };
    }),
  ];

  const handleClear = () => {
    clearHistoryClicked({ dashboard_count: counts.dashboard, total_count: total });
    clear();
  };

  return (
    <CardFooter
      filter={
        kinds.length > 1 && (
          <FooterFilterCombobox<RecentActivityFilter>
            label={filter === 'all' ? allLabel : getPageKindMeta(filter).filterLabel}
            aria-label={t('home.recent-activity-tab.filter-label', 'Show only')}
            options={options}
            value={filter}
            onChange={(option) => {
              // Re-selecting the current value is a no-op so nothing re-renders or reports.
              if (option.value !== filter) {
                recentActivityFilterChanged({ filter: option.value });
                setFilter(option.value);
              }
            }}
          />
        )
      }
    >
      <FooterAction onClick={handleClear}>
        <Trans i18nKey="home.recent-activity-tab.clear">Clear recent activity</Trans>
      </FooterAction>
    </CardFooter>
  );
}
