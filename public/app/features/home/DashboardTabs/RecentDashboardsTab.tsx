import { css } from '@emotion/css';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, LinkButton, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';
import { AccessControlAction } from 'app/types/accessControl';

interface Props {
  dashboards: DashboardQueryResult[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
}

export function RecentDashboardsTab({ dashboards, loading, error, retry, foldersByUid }: Props) {
  const styles = useStyles2(getStyles);

  if (loading) {
    return <PageLoader text={t('home.recent-dashboards-tab.loading', 'Loading recently viewed dashboards...')} />;
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        title={t('home.recent-dashboards-tab.error-title', 'Could not load recently viewed dashboards')}
        action={
          <Button onClick={retry} variant="secondary" size="sm">
            <Trans i18nKey="home.recent-dashboards-tab.retry">Retry</Trans>
          </Button>
        }
      />
    );
  }

  if (dashboards.length === 0) {
    const canCreate = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);

    return (
      <EmptyState
        hideImage
        variant="call-to-action"
        message={t('home.recent-dashboards-tab.empty', "Dashboards you've recently viewed will appear here.")}
        button={
          canCreate ? (
            <LinkButton icon="plus" href="/dashboard/new">
              <Trans i18nKey="home.recent-dashboards-tab.create">Create your first dashboard</Trans>
            </LinkButton>
          ) : (
            <LinkButton icon="apps" href="/dashboards" variant="secondary">
              <Trans i18nKey="home.recent-dashboards-tab.browse">Browse dashboards</Trans>
            </LinkButton>
          )
        }
      >
        <Trans i18nKey="home.recent-dashboards-tab.empty-description">
          After you&apos;ve connected data, you can use dashboards to query and visualize your data with charts, stats
          and tables or create lists, markdowns and other widgets.
        </Trans>
      </EmptyState>
    );
  }

  const handleClearHistory = () => {
    impressionSrv.clearImpressions();
    retry();
  };

  return (
    <div className={styles.wrapper}>
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
      <div className={styles.clearButton}>
        <Button icon="times" size="xs" variant="secondary" fill="text" onClick={handleClearHistory}>
          <Trans i18nKey="home.recent-dashboards-tab.clear">Clear history</Trans>
        </Button>
      </div>
    </div>
  );
}

const getStyles = () => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  }),
  list: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
  }),
  clearButton: css({
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 4,
    marginTop: 'auto',
  }),
});
