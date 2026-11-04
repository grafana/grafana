import { t, Trans } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';

import { FooterAction, FooterFilterCombobox } from '../FooterActions';
import { clearHistoryClicked, recentActivityFilterChanged } from '../analytics/main';

import { getPageKindMeta } from './recentActivityRows';
import { type RecentActivity, type RecentActivityFilter } from './useRecentActivity';

interface Props {
  recent: RecentActivity;
}

/** Narrows the list to one kind of page. Only worth offering once the history holds more than one kind. */
export function RecentActivityFilterCombobox({ recent }: Props) {
  const { kinds, filter, setFilter } = recent;
  const allLabel = t('home.recent-activity-tab.filter-all', 'All');
  // Each kind carries its icon so the closed dropdown shows the picked kind the way its rows do.
  const options: Array<ComboboxOption<RecentActivityFilter>> = [
    { value: 'all', label: allLabel },
    ...kinds.map((kind) => {
      const { filterLabel, icon } = getPageKindMeta(kind);
      return { value: kind, label: filterLabel, icon };
    }),
  ];

  return (
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
  );
}

/** Clears the whole history, reporting what it held. */
export function ClearRecentActivityAction({ recent }: Props) {
  const { counts, total, clear } = recent;

  return (
    <FooterAction
      onClick={() => {
        clearHistoryClicked({ dashboard_count: counts.dashboard, total_count: total });
        clear();
      }}
    >
      <Trans i18nKey="home.recent-activity-tab.clear">Clear recent activity</Trans>
    </FooterAction>
  );
}
