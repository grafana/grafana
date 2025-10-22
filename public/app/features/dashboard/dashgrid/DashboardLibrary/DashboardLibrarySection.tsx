import { css } from '@emotion/css';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, Grid } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';
import dashboardLibrary1 from 'img/dashboard-library/dashboard_library_1.jpg';
import dashboardLibrary2 from 'img/dashboard-library/dashboard_library_2.jpg';
import dashboardLibrary3 from 'img/dashboard-library/dashboard_library_3.jpg';
import dashboardLibrary4 from 'img/dashboard-library/dashboard_library_4.jpg';
import dashboardLibrary5 from 'img/dashboard-library/dashboard_library_5.jpg';
import dashboardLibrary6 from 'img/dashboard-library/dashboard_library_6.jpg';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardLibraryInteractions } from './interactions';

export const DashboardLibrarySection = () => {
  const [searchParams] = useSearchParams();
  const datasourceUid = searchParams.get('dashboardLibraryDatasourceUid');

  const [showAll, setShowAll] = useState(false);

  const { value: templateDashboards } = useAsync(async (): Promise<PluginDashboard[]> => {
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

  const hasMoreThanThree = templateDashboards && templateDashboards.length > 3;
  const dashboardsToShow = showAll ? templateDashboards : templateDashboards?.slice(0, 3);

  const styles = useStyles2(getStyles, dashboardsToShow?.length);

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

  if (!templateDashboards?.length) {
    return null;
  }

  return (
    <Box borderColor="strong" borderStyle="dashed" padding={4} flex={1}>
      <Stack direction="column" alignItems="center" gap={2}>
        <Box marginTop={2}>
          <Grid
            gap={4}
            columns={{
              xs: 1,
              sm: (dashboardsToShow?.length || 1) >= 2 ? 2 : 1,
              lg: (dashboardsToShow?.length || 1) >= 3 ? 3 : (dashboardsToShow?.length || 1) >= 2 ? 2 : 1,
            }}
          >
            {dashboardsToShow?.map((dashboard, index) => (
              <TemplateDashboardBox
                key={dashboard.uid}
                index={index}
                dashboard={dashboard}
                onImportClick={onImportDashboardClick}
              />
            )) || []}
          </Grid>
        </Box>
        {hasMoreThanThree && (
          <Button
            variant="secondary"
            fill="outline"
            size="sm"
            onClick={() => setShowAll((prev) => !prev)}
            className={styles.showMoreButton}
          >
            {showAll ? (
              <Trans i18nKey="dashboard.empty.show-less-dashboards">Show less</Trans>
            ) : (
              <Trans i18nKey="dashboard.empty.show-more-dashboards">Show more</Trans>
            )}
          </Button>
        )}
      </Stack>
    </Box>
  );
};

const TemplateDashboardBox = ({
  dashboard,
  onImportClick,
  index,
}: {
  dashboard: PluginDashboard;
  onImportClick: (d: PluginDashboard) => void;
  index: number;
}) => {
  const dashboardLibraryImages = [
    dashboardLibrary1,
    dashboardLibrary2,
    dashboardLibrary3,
    dashboardLibrary4,
    dashboardLibrary5,
    dashboardLibrary6,
  ];

  const styles = useStyles2(getStyles);
  return (
    <div className={styles.templateDashboardBox}>
      <img
        src={index <= 5 ? dashboardLibraryImages[index] : dashboardLibraryImages[index % dashboardLibraryImages.length]}
        width={285}
        height={160}
        alt={dashboard.title}
        className={styles.templateDashboardImage}
      />
      <div className={styles.templateDashboardTitle}>
        <Text element="p" textAlignment="center">
          {dashboard.title}
        </Text>
      </div>
      <Button fill="outline" onClick={() => onImportClick(dashboard)} size="sm">
        <Trans i18nKey="dashboard.empty.use-template-button">Use this dashboard</Trans>
      </Button>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2, dashboardsLength?: number) {
  return {
    templateDashboardBox: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      alignItems: 'center',
    }),
    templateDashboardTitle: css({
      flex: 1,
    }),
    templateDashboardImage: css({
      borderRadius: theme.shape.radius.default,
      borderColor: theme.colors.text.primary,
      borderWidth: 1,
      borderStyle: 'solid',
      objectFit: 'cover',
    }),
    showMoreButton: css({
      marginTop: theme.spacing(2),
    }),
  };
}
