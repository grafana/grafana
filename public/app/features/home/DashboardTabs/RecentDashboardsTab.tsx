import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, LinkButton, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';
import { AccessControlAction } from 'app/types/accessControl';

import { clearHistoryClicked, emptyCtaClicked } from '../analytics/main';

interface Props {
  dashboards: DashboardQueryResult[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  onStarChange?: () => void;
}

export function RecentDashboardsTab({ dashboards, loading, error, retry, foldersByUid, onStarChange }: Props) {
  const styles = useStyles2(getStyles);

  if (loading) {
    return <PageLoader text={t('home.recent-dashboards-tab.loading', 'Loading recently viewed dashboards...')} />;
  }

  if (error) {
    return (
      <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
        {/* Extra div as Alert will flex-grow by default, but we want it centered */}
        <div>
          <Alert
            severity="warning"
            title={t('home.recent-dashboards-tab.error-title', 'Could not load recently viewed dashboards')}
            action={
              <Button onClick={retry} variant="secondary" size="sm">
                <Trans i18nKey="home.recent-dashboards-tab.retry">Retry</Trans>
              </Button>
            }
          />
        </div>
      </Stack>
    );
  }

  if (dashboards.length === 0) {
    const canCreate = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);

    return (
      <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
        <EmptyState
          hideImage
          variant="call-to-action"
          message={t('home.recent-dashboards-tab.empty', "Dashboards you've recently viewed will appear here.")}
          button={
            canCreate ? (
              <LinkButton
                icon="plus"
                href="/dashboard/new"
                onClick={() => emptyCtaClicked({ cta_type: 'create_dashboard' })}
              >
                <Trans i18nKey="home.recent-dashboards-tab.create">Create your first dashboard</Trans>
              </LinkButton>
            ) : (
              <LinkButton
                icon="apps"
                href="/dashboards"
                variant="secondary"
                onClick={() => emptyCtaClicked({ cta_type: 'browse_dashboards' })}
              >
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
      </Stack>
    );
  }

  const handleClearHistory = () => {
    clearHistoryClicked({ dashboard_count: dashboards.length });
    impressionSrv.clearImpressions();
    retry();
  };

  return (
    <Stack grow={1} direction="column">
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
              onStarChange={onStarChange}
            />
          </li>
        ))}
      </ul>
      <div className={styles.clearButton}>
        <Button icon="times" size="sm" variant="secondary" fill="text" onClick={handleClearHistory}>
          <Trans i18nKey="home.recent-dashboards-tab.clear">Clear history</Trans>
        </Button>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
  }),
  clearButton: css({
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(1),
    marginTop: 'auto',

    svg: {
      position: 'relative',
      top: 0.5,
    },
  }),
});
