import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

import { HomeList } from '../HomeList';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError } from './DashboardTabError';

interface Props {
  dashboards: DashboardQueryResult[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  loadingText: string;
  errorTitle: string;
  emptyMessage: string;
  // Identifies the tab in the row click analytics.
  source: string;
  onStarChange?: () => void;
}

/** A tab body listing dashboards with their folder: the load, error and empty states around the rows. */
export function DashboardListTab({
  dashboards,
  loading,
  error,
  retry,
  foldersByUid,
  loadingText,
  errorTitle,
  emptyMessage,
  source,
  onStarChange,
}: Props) {
  if (loading) {
    return <PageLoader text={loadingText} />;
  }

  if (error) {
    return <DashboardTabError title={errorTitle} retry={retry} />;
  }

  if (dashboards.length === 0) {
    return <DashboardTabEmptyState message={emptyMessage} />;
  }

  return (
    <HomeList>
      {dashboards.map((dash) => (
        <li key={dash.uid}>
          <DashListItem
            dashboard={dash}
            url={dash.url}
            showFolderNames={true}
            locationInfo={foldersByUid[dash.location]}
            layoutMode="list"
            source={source}
            onStarChange={onStarChange}
          />
        </li>
      ))}
    </HomeList>
  );
}
