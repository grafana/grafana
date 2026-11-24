import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

import { HomeList } from '../HomeList';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError, DashboardTabErrorAlert } from './DashboardTabError';

interface Props {
  dashboards: DashboardQueryResult[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  loadingText: string;
  errorTitle: string;
  emptyMessage: string;
  // Identifies the tab in the row click analytics.
  source: string;
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
}: Props) {
  if (loading) {
    return <PageLoader text={loadingText} />;
  }

  // Without a row to show, the error is the whole tab
  if (error && dashboards.length === 0) {
    return <DashboardTabError title={errorTitle} retry={retry} />;
  }

  if (dashboards.length === 0) {
    return <DashboardTabEmptyState message={emptyMessage} />;
  }

  return (
    <>
      {/* Not every row could be loaded; those that were still show */}
      {error && <DashboardTabErrorAlert title={errorTitle} retry={retry} />}
      <HomeList>
        {dashboards.map((dash) => (
          <li key={`${dash.kind}-${dash.uid}`}>
            <DashListItem
              dashboard={dash}
              url={dash.url}
              showFolderNames={true}
              locationInfo={foldersByUid[dash.location]}
              layoutMode="list"
              source={source}
            />
          </li>
        ))}
      </HomeList>
    </>
  );
}
