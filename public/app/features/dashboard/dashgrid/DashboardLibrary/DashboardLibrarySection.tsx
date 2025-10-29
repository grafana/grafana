import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { useStyles2, Stack, Grid, Pagination, EmptyState, Button } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import { fetchProvisionedDashboards } from './api/dashboardLibraryApi';
import { DashboardLibraryInteractions } from './interactions';
import { getProvisionedDashboardImageUrl } from './utils/provisionedDashboardHelpers';

// Constants for datasource-provided dashboards pagination
const PAGE_SIZE = 9;

export const DashboardLibrarySection = () => {
  const [searchParams] = useSearchParams();
  const datasourceUid = searchParams.get('dashboardLibraryDatasourceUid');

  const [currentPage, setCurrentPage] = useState(1);

  // Get datasource info for empty state
  const datasourceType = useMemo(() => {
    if (!datasourceUid) {
      return '';
    }
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    return ds?.type || '';
  }, [datasourceUid]);

  const { value: templateDashboards, loading } = useAsync(async (): Promise<PluginDashboard[]> => {
    if (!datasourceUid) {
      return [];
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return [];
    }

    const dashboards = await fetchProvisionedDashboards(ds.type);

    if (dashboards.length > 0) {
      DashboardLibraryInteractions.loaded({
        numberOfItems: dashboards.length,
        contentKinds: ['datasource_dashboard'],
        datasourceTypes: [ds.type],
        sourceEntryPoint: 'datasource_page',
      });
    }

    return dashboards;
  }, [datasourceUid]);

  // Calculate pagination
  const totalDashboards = templateDashboards?.length || 0;
  const totalPages = Math.ceil(totalDashboards / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const dashboardsToShow = templateDashboards?.slice(startIndex, endIndex);

  const styles = useStyles2(getStyles);

  // Determine what to show
  const showEmptyState = !loading && (!templateDashboards || templateDashboards.length === 0);

  const onUseProvisionedDashboard = async (dashboard: PluginDashboard) => {
    DashboardLibraryInteractions.itemClicked({
      contentKind: 'datasource_dashboard',
      datasourceTypes: [dashboard.pluginId],
      libraryItemId: dashboard.uid,
      libraryItemTitle: dashboard.title,
      sourceEntryPoint: 'datasource_page',
    });

    const params = new URLSearchParams({
      datasource: datasourceUid || '',
      title: dashboard.title || 'Template',
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      // tracking event purpose values
      sourceEntryPoint: 'datasource_page',
      libraryItemId: dashboard.uid,
      creationOrigin: 'dashboard_library_datasource_dashboard',
    });

    const templateUrl = `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
    locationService.push(templateUrl);
  };

  return (
    <Stack direction="column" gap={2}>
      {showEmptyState ? (
        <EmptyState
          variant="call-to-action"
          message={
            datasourceType
              ? t(
                  'dashboard.library.provisioned-empty-title-with-datasource',
                  'No {{datasourceType}} provisioned dashboards found',
                  { datasourceType }
                )
              : t('dashboard.library.provisioned-empty-title', 'No provisioned dashboards found')
          }
          button={
            <Button variant="secondary" onClick={() => window.open('https://grafana.com/grafana/plugins/', '_blank')}>
              <Trans i18nKey="dashboard.library.browse-plugins">Browse plugins</Trans>
            </Button>
          }
        >
          <Trans i18nKey="dashboard.library.no-provisioned-dashboards">
            Provisioned dashboards are provided by data source plugins. You can find more plugins on Grafana.com.
          </Trans>
        </EmptyState>
      ) : (
        <Grid
          gap={4}
          columns={{
            xs: 1,
            sm: loading ? 2 : (dashboardsToShow?.length || 1) >= 2 ? 2 : 1,
            lg: loading ? 3 : (dashboardsToShow?.length || 1) >= 3 ? 3 : (dashboardsToShow?.length || 1) >= 2 ? 2 : 1,
          }}
        >
          {loading && !templateDashboards
            ? Array.from({ length: 9 }).map((_, i) => <div key={i} className={styles.skeleton} />)
            : dashboardsToShow?.map((dashboard, index) => {
                // Use global index for consistent image assignment across pages
                const globalIndex = startIndex + index;
                const imageUrl = getProvisionedDashboardImageUrl(globalIndex);

                return (
                  <DashboardCard
                    key={dashboard.uid}
                    title={dashboard.title}
                    imageUrl={imageUrl}
                    dashboard={dashboard}
                    onClick={() => onUseProvisionedDashboard(dashboard)}
                    buttonText={<Trans i18nKey="dashboard-template.card.use-dashboard-button">Use dashboard</Trans>}
                  />
                );
              }) || []}
        </Grid>
      )}
      {!showEmptyState && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          numberOfPages={totalPages}
          onNavigate={(page) => setCurrentPage(page)}
          className={styles.pagination}
        />
      )}
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    skeleton: css({
      height: '300px',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      '@keyframes pulse': {
        '0%, 100%': {
          opacity: 1,
        },
        '50%': {
          opacity: 0.5,
        },
      },
    }),
    pagination: css({
      position: 'sticky',
      bottom: 0,
      backgroundColor: theme.colors.background.primary,
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(1),
      marginTop: theme.spacing(2),
      alignItems: 'center',
      zIndex: 2,
    }),
  };
}
