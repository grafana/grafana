import { css } from '@emotion/css';
import { useAsyncRetry } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, TextLink, useStyles2 } from '@grafana/ui';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

const MAX_STARRED = 30;

interface StarredDashboardsTabProps {
  onCountChange: (count: number) => void;
}

export function StarredDashboardsTab({ onCountChange }: StarredDashboardsTabProps) {
  const styles = useStyles2(getStyles);
  const {
    value: dashboards = [],
    loading,
    error,
    retry,
  } = useAsyncRetry(async () => {
    const response = await getGrafanaSearcher().starred({ limit: MAX_STARRED });
    const results = response.view.toArray();
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
        title={t('home.starred-dashboards-tab.error-title', 'Could not load starred dashboards')}
      >
        <button onClick={retry}>
          <Trans i18nKey="home.starred-dashboards-tab.retry">Retry</Trans>
        </button>
      </Alert>
    );
  }

  if (dashboards.length === 0) {
    return (
      <EmptyState variant="call-to-action" message={t('home.starred-dashboards-tab.empty', 'No starred dashboards')}>
        <TextLink href="/dashboards">
          <Trans i18nKey="home.starred-dashboards-tab.browse">Browse dashboards to star your favorites</Trans>
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
            source="homepage_starredTab"
            onStarChange={retry}
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
