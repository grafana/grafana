import { css } from '@emotion/css';
import { useAsyncRetry } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, TextLink, useStyles2 } from '@grafana/ui';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

import { getRecentlyViewedDashboards } from '../../browse-dashboards/api/recentlyViewed';

const MAX_RECENT = 20;

interface RecentDashboardsTabProps {
  onCountChange: (count: number) => void;
}

export function RecentDashboardsTab({ onCountChange }: RecentDashboardsTabProps) {
  const styles = useStyles2(getStyles);
  const {
    value: dashboards = [],
    loading,
    error,
    retry,
  } = useAsyncRetry(async () => {
    const results = await getRecentlyViewedDashboards(MAX_RECENT);
    onCountChange(results.length);
    return results;
  }, []);

  const { foldersByUid } = useDashboardLocationInfo(dashboards.length > 0);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        title={t('home.recent-dashboards-tab.error-title', 'Could not load recently viewed dashboards')}
      >
        <button onClick={retry}>
          <Trans i18nKey="home.recent-dashboards-tab.retry">Retry</Trans>
        </button>
      </Alert>
    );
  }

  if (dashboards.length === 0) {
    return (
      <EmptyState
        variant="call-to-action"
        message={t('home.recent-dashboards-tab.empty', 'No recently viewed dashboards')}
      >
        <TextLink href="/dashboards">
          <Trans i18nKey="home.recent-dashboards-tab.browse">Browse dashboards</Trans>
        </TextLink>
      </EmptyState>
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
            source="homepage_recentTab"
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
