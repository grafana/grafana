import { EmptyState } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { SearchState } from 'app/features/search/types';

interface RecentlyDeletedEmptyStateProps {
  searchState: SearchState;
}

export const RecentlyDeletedEmptyState = ({ searchState }: RecentlyDeletedEmptyStateProps) => {
  const userIsSearching = Boolean(searchState.query || searchState.tag.length);
  return (
    <EmptyState
      message={
        userIsSearching
          ? t('recently-deleted.page.no-search-result', 'No results found for your query')
          : t('recently-deleted.page.no-deleted-dashboards', "You haven't deleted any dashboards recently.")
      }
      variant={userIsSearching ? 'not-found' : 'completed'}
      role="alert"
    />
  );
};
