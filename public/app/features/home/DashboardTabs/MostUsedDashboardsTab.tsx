import { css } from '@emotion/css';

import { t, Trans } from '@grafana/i18n';
import { EmptyState, Stack, useStyles2 } from '@grafana/ui';
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
  density?: 'default' | 'compact';
}

export function MostUsedDashboardsTab({ dashboards, loading, error, retry, foldersByUid, density }: Props) {
  const styles = useStyles2(getStyles);

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
      <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
        <EmptyState
          hideImage
          variant="completed"
          message={t('home.most-used-dashboards-tab.empty', 'Most used dashboards will appear here.')}
        >
          <Trans i18nKey="home.most-used-dashboards-tab.empty-description">
            Once your organization has dashboards and usage data has been collected, dashboards with the most views over
            the last 30 days will be displayed here.
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
            source="homepage_mostUsedTab"
            density={density}
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
