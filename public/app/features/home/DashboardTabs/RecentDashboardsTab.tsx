import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { EmptyState, LinkButton, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/services/context_srv';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';
import { AccessControlAction } from 'app/types/accessControl';

import { ctaClicked } from '../analytics/main';

import { DashboardTabError } from './DashboardTabError';
import { RecentDashboardsClearButton } from './RecentDashboardsClearButton';

interface Props {
  dashboards: DashboardQueryResult[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  onStarChange?: () => void;
  density?: 'default' | 'compact';
}

export function RecentDashboardsTab({ dashboards, loading, error, retry, foldersByUid, onStarChange, density }: Props) {
  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const styles = useStyles2(getStyles, redesignEnabled);

  if (loading) {
    return <PageLoader text={t('home.recent-dashboards-tab.loading', 'Loading recently viewed dashboards...')} />;
  }

  if (error) {
    return (
      <DashboardTabError
        title={t('home.recent-dashboards-tab.error-title', 'Could not load recently viewed dashboards')}
        retry={retry}
      />
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
                onClick={() =>
                  ctaClicked({ surface: 'recent_tab', action: 'create_dashboard', placement: 'empty_state' })
                }
              >
                <Trans i18nKey="home.recent-dashboards-tab.create">Create your first dashboard</Trans>
              </LinkButton>
            ) : (
              <LinkButton
                icon="apps"
                href="/dashboards"
                variant="secondary"
                onClick={() =>
                  ctaClicked({ surface: 'recent_tab', action: 'browse_dashboards', placement: 'empty_state' })
                }
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
              density={density}
            />
          </li>
        ))}
      </ul>
      {/* In the redesign the clear button is pinned outside the scroll area by DashboardTabs. */}
      {density !== 'compact' && <RecentDashboardsClearButton dashboards={dashboards} retry={retry} />}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2, redesign: boolean) => ({
  list: css({
    listStyle: 'none',
    padding: theme.spacing(0, redesign ? 0 : 0.5),
    margin: 0,
  }),
});
