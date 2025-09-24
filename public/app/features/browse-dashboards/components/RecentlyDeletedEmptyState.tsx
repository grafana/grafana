import { Trans, t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';
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
    >
      <Trans i18nKey={'recently-deleted.page.no-deleted-dashboards-text'}>
        When you delete a dashboard, it will appear here for 30 days before being permanently deleted. Your organization
        administrator can restore recently-deleted dashboards.
      </Trans>
    </EmptyState>
  );
};
