import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';
import { useSelector } from 'app/types/store';
import templateDashboard1 from 'img/template-dashboards/template_dashboard_1.png';
import templateDashboard2 from 'img/template-dashboards/template_dashboard_2.png';
import templateDashboard3 from 'img/template-dashboards/template_dashboard_3.png';

export const DashboardLibrarySection = () => {
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  const [showAll, setShowAll] = useState(false);

  const { value: templateDashboards } = useAsync(async (): Promise<PluginDashboard[]> => {
    if (!initialDatasource) {
      return [];
    }

    const ds = getDataSourceSrv().getInstanceSettings(initialDatasource);
    if (!ds) {
      return [];
    }

    const dashboards = await getBackendSrv().get(`api/plugins/${ds.type}/dashboards`);
    if (dashboards.length > 0) {
      reportInteraction('grafana_dashboard_empty_page_template_dashboards_loaded', {
        count: dashboards.length,
        datasource: ds.type,
      });
    }

    return dashboards;
  }, [initialDatasource]);

  const onImportDashboardClick = async (dashboard: PluginDashboard) => {
    reportInteraction('grafana_dashboard_empty_page_template_dashboard_clicked', {
      id: dashboard.uid,
      title: dashboard.title,
      datasource: dashboard.pluginId,
    });

    const templateUrl =
      `/dashboard/template?` +
      `datasource=${encodeURIComponent(initialDatasource || '')}&` +
      `title=${encodeURIComponent(dashboard.title || 'Template')}&` +
      `pluginId=${encodeURIComponent(dashboard.pluginId)}&` +
      `path=${encodeURIComponent(dashboard.path)}`;

    locationService.push(templateUrl);
  };

  const hasMoreThanThree = templateDashboards && templateDashboards.length > 3;
  const dashboardsToShow = showAll ? templateDashboards : templateDashboards?.slice(0, 3);

  const styles = useStyles2(getStyles, dashboardsToShow?.length);

  if (!templateDashboards?.length) {
    return null;
  }

  return (
    <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
      <Stack direction="column" alignItems="center" gap={2}>
        <Text element="h3" textAlignment="center" weight="medium">
          <Trans i18nKey="dashboard.empty.start-with-suggested-dashboards">
            Start with a pre-made dashboard from your data source
          </Trans>
        </Text>
        <div className={styles.dashboardGrid}>
          {dashboardsToShow?.map((dashboard, index) => (
            <TemplateDashboardBox
              key={dashboard.uid}
              index={index}
              dashboard={dashboard}
              onImportClick={onImportDashboardClick}
            />
          ))}
        </div>
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
  const templateDashboardImages = [templateDashboard1, templateDashboard2, templateDashboard3];

  const styles = useStyles2(getStyles);
  return (
    <div className={styles.provisionedDashboardBox}>
      <img
        src={
          index <= 2 ? templateDashboardImages[index] : templateDashboardImages[index % templateDashboardImages.length]
        }
        width={177}
        height={150}
        alt={dashboard.title}
        className={styles.templateDashboardImage}
      />
      <div className={styles.privisionedDashboardSection}>
        <div className={styles.privisionedDashboardTitle}>
          <Text element="p" textAlignment="center">
            {dashboard.title}
          </Text>
        </div>
        <Button fill="outline" onClick={() => onImportClick(dashboard)} size="sm">
          <Trans i18nKey="dashboard.empty.use-template-button">Use this dashboard</Trans>
        </Button>
      </div>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2, dashboardsLength?: number) {
  return {
    provisionedDashboardBox: css({
      width: '177px',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
      alignItems: 'center',
    }),
    privisionedDashboardSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      flex: 1,
      alignItems: 'center',
    }),
    privisionedDashboardTitle: css({
      flex: 1,
    }),
    templateDashboardImage: css({
      objectFit: 'cover',
    }),
    dashboardGrid: css({
      display: 'grid',
      gridTemplateColumns: '1fr',
      columnGap: theme.spacing(6),
      rowGap: theme.spacing(4),
      justifyItems: 'center',

      [theme.breakpoints.up('md')]: {
        gridTemplateColumns: `repeat(${dashboardsLength && dashboardsLength < 3 ? dashboardsLength : 3}, 1fr)`,
      },
    }),
    showMoreButton: css({
      marginTop: theme.spacing(2),
    }),
  };
}
