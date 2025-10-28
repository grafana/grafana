import { css } from '@emotion/css';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { useStyles2, Stack, Grid, Pagination } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';
import dashboardLibrary1 from 'img/dashboard-library/dashboard_library_1.jpg';
import dashboardLibrary2 from 'img/dashboard-library/dashboard_library_2.jpg';
import dashboardLibrary3 from 'img/dashboard-library/dashboard_library_3.jpg';
import dashboardLibrary4 from 'img/dashboard-library/dashboard_library_4.jpg';
import dashboardLibrary5 from 'img/dashboard-library/dashboard_library_5.jpg';
import dashboardLibrary6 from 'img/dashboard-library/dashboard_library_6.jpg';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import { DashboardLibraryInteractions } from './interactions';

export const DashboardLibrarySection = () => {
  const [searchParams] = useSearchParams();
  const datasourceUid = searchParams.get('dashboardLibraryDatasourceUid');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const { value: templateDashboards, loading } = useAsync(async (): Promise<PluginDashboard[]> => {
    if (!datasourceUid) {
      return [];
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return [];
    }

    try {
      const dashboards = await getBackendSrv().get(`api/plugins/${ds.type}/dashboards`, undefined, undefined, {
        showErrorAlert: false,
      });

      if (dashboards.length > 0) {
        DashboardLibraryInteractions.loaded({
          numberOfItems: dashboards.length,
          contentKinds: ['datasource_dashboard'],
          datasourceTypes: [ds.type],
          sourceEntryPoint: 'datasource_page',
        });
      }
      return dashboards;
    } catch (error) {
      console.error('Error loading template dashboards', error);
      return [];
    }
  }, [datasourceUid]);

  // Calculate pagination
  const totalDashboards = templateDashboards?.length || 0;
  const totalPages = Math.ceil(totalDashboards / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const dashboardsToShow = templateDashboards?.slice(startIndex, endIndex);

  const styles = useStyles2(getStyles);

  const onImportDashboardClick = async (dashboard: PluginDashboard) => {
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

  if (!loading && !templateDashboards?.length) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
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
              const dashboardLibraryImages = [
                dashboardLibrary1,
                dashboardLibrary2,
                dashboardLibrary3,
                dashboardLibrary4,
                dashboardLibrary5,
                dashboardLibrary6,
              ];
              // Use global index for consistent image assignment
              const globalIndex = startIndex + index;
              const imageUrl =
                globalIndex <= 5
                  ? dashboardLibraryImages[globalIndex]
                  : dashboardLibraryImages[globalIndex % dashboardLibraryImages.length];

              return (
                <DashboardCard
                  key={dashboard.uid}
                  title={dashboard.title}
                  imageUrl={imageUrl}
                  dashboard={dashboard}
                  onClick={() => onImportDashboardClick(dashboard)}
                />
              );
            }) || []}
      </Grid>
      {totalPages > 1 && (
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
