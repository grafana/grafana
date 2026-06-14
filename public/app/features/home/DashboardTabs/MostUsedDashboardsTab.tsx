import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { EmptyState, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

import { DashboardTabError } from './DashboardTabError';

interface Props {
  dashboards: DashboardQueryResult[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
}

export function MostUsedDashboardsTab({ dashboards, loading, error, retry, foldersByUid }: Props) {
  const styles = useStyles2(getStyles);

  if (loading) {
    return <PageLoader text={t('home.most-used-dashboards-tab.loading', 'Loading most viewed dashboards...')} />;
  }

  if (error) {
    return (
      <DashboardTabError
        title={t('home.most-used-dashboards-tab.error-title', 'Could not load most viewed dashboards')}
        retry={retry}
      />
    );
  }

  if (dashboards.length === 0) {
    return (
      <EmptyState
        hideImage
        variant="completed"
        message={t(
          'home.most-used-dashboards-tab.empty',
          'Most viewed dashboards in your organization will appear here once usage data is collected.'
        )}
      />
    );
  }

  return (
    <ul className={styles.list}>
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
    </ul>
  );
}

const getStyles = () => ({
  list: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
  }),
});
