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
        When you delete a dashboard, it will be kept in the history for up to 12 months before being permanently
        deleted. Users with delete permissions can restore the dashboards they deleted, and admins can restore
        dashboards deleted by any user.
      </Trans>
    </EmptyState>
  );
};
