import { t } from '@grafana/i18n';
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
}

export function MostUsedDashboardsTab({ dashboards, loading, error, retry, foldersByUid }: Props) {
  if (loading) {
    return <PageLoader text={t('home.most-used-dashboards-tab.loading', 'Loading most used dashboards...')} />;
  }

  if (error) {
    return (
      <DashboardTabError
        title={t('home.most-used-dashboards-tab.error-title', 'Could not load most used dashboards')}
        retry={retry}
      />
    );
  }

  if (dashboards.length === 0) {
    return (
      <DashboardTabEmptyState
        message={t('home.most-used-dashboards-tab.empty', 'Most used dashboards will appear here.')}
      />
    );
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
            source="homepage_mostUsedTab"
          />
        </li>
      ))}
    </HomeList>
  );
}
