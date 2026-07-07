import { css } from '@emotion/css';

import { t, Trans } from '@grafana/i18n';
import { EmptyState, Icon, Stack, useStyles2 } from '@grafana/ui';
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

export function StarredDashboardsTab({ dashboards, loading, error, retry, foldersByUid }: Props) {
  const styles = useStyles2(getStyles);

  if (loading) {
    return <PageLoader text={t('home.starred-dashboards-tab.loading', 'Loading starred dashboards...')} />;
  }

  if (error) {
    return (
      <DashboardTabError
        title={t('home.starred-dashboards-tab.error-title', 'Could not load starred dashboards')}
        retry={retry}
      />
    );
  }

  if (dashboards.length === 0) {
    return (
      <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
        <EmptyState
          hideImage
          variant="completed"
          message={t('home.starred-dashboards-tab.empty', 'Your starred dashboards will appear here.')}
        >
          <Trans i18nKey="home.starred-dashboards-tab.empty-description">
            You can star your favorite dashboards by clicking the <Icon name="star" /> from the dashboard page.
          </Trans>
        </EmptyState>
      </Stack>
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
