import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { Divider, EmptyState, useStyles2 } from '@grafana/ui';
import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueriesFilters } from './RecentQueriesFilters';
import { RecentQueriesList } from './RecentQueriesList';
import { useRecentQueriesData } from './useRecentQueriesData';

type Props = {
  /**
   * Called when the user picks a query to use in the host editor. When omitted (e.g. a
   * standalone browse/save surface with no host editor), the Select action is not rendered.
   */
  onSelectQuery?: (query: RichHistoryQuery) => void;
  onClose: () => void;
  onSaveToLibrary?: (query: RichHistoryQuery) => void;
  onAnalyticsEvent?: (event: string, properties?: Record<string, string | boolean | undefined>) => void;
};

export function RecentQueriesLayout({ onSelectQuery, onClose, onSaveToLibrary, onAnalyticsEvent }: Props) {
  const styles = useStyles2(getStyles);
  const { queries, isLoading, isInitialLoad, error, filters, setFilters, starQuery } = useRecentQueriesData();

  const { items: dataSourceItems } = useDataSourceInstanceList({ mixed: true });
  const availableDatasources = useMemo(() => dataSourceItems.map((ds) => ds.name), [dataSourceItems]);

  const handleSelectQuery = useMemo(() => {
    if (!onSelectQuery) {
      return undefined;
    }
    return (query: RichHistoryQuery) => {
      onSelectQuery(query);
      onClose();
    };
  }, [onSelectQuery, onClose]);

  const handleStarQuery = useCallback(
    (id: string, starred: boolean) => {
      onAnalyticsEvent?.('queryStarred', { starred });
      starQuery(id, starred);
    },
    [starQuery, onAnalyticsEvent]
  );

  const handleClear = useCallback(() => {
    setFilters({
      searchQuery: '',
      datasourceFilters: [],
      sortingOption: {
        value: SortOrder.Descending,
        label: t('recent-queries.sort.newest', 'Newest first'),
      },
      showStarredOnly: false,
    });
  }, [setFilters]);

  if (error) {
    return (
      <EmptyState variant="not-found" message={t('recent-queries.error-state.title', 'Something went wrong!')}>
        {error instanceof Error ? error.message : ''}
      </EmptyState>
    );
  }

  return (
    <div className={styles.layout}>
      <RecentQueriesFilters
        filters={filters}
        setFilters={setFilters}
        availableDatasources={availableDatasources}
        onClear={handleClear}
        showStarredFilter={!onSaveToLibrary}
        disabled={isInitialLoad}
        onAnalyticsEvent={onAnalyticsEvent}
      />
      <Divider direction="vertical" spacing={0} />
      <RecentQueriesList
        queries={queries}
        isLoading={isLoading}
        sortOrder={filters.sortingOption.value ?? SortOrder.Descending}
        onSelectQuery={handleSelectQuery}
        onStarQuery={handleStarQuery}
        onSaveQuery={onSaveToLibrary}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    paddingTop: theme.spacing(2),
  }),
});
