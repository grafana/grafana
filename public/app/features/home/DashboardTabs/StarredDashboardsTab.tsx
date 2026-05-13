import { css } from '@emotion/css';

import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, TextLink, useStyles2 } from '@grafana/ui';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

interface Props {
  dashboards: DashboardQueryResult[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
}

export function StarredDashboardsTab({ dashboards, loading, error, retry, foldersByUid }: Props) {
  const styles = useStyles2(getStyles);

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
