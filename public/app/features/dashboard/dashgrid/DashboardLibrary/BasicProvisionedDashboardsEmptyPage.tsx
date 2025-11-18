import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, Grid } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { fetchProvisionedDashboards } from './api/dashboardLibraryApi';
import {
  CONTENT_KINDS,
  CREATION_ORIGINS,
  DashboardLibraryInteractions,
  DISCOVERY_METHODS,
  EVENT_LOCATIONS,
  SOURCE_ENTRY_POINTS,
} from './interactions';
import { getProvisionedDashboardImageUrl } from './utils/provisionedDashboardHelpers';

interface Props {
  datasourceUid?: string;
}

export const BasicProvisionedDashboardsEmptyPage = ({ datasourceUid }: Props) => {
  const [showAll, setShowAll] = useState(false);

  const { value: templateDashboards } = useAsync(async (): Promise<PluginDashboard[]> => {
    if (!datasourceUid) {
      return [];
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return [];
    }

    const dashboards = await fetchProvisionedDashboards(ds.type);
    return dashboards;
  }, [datasourceUid]);

  const hasMoreThanThree = templateDashboards && templateDashboards.length > 3;
  const dashboardsToShow = showAll ? templateDashboards : templateDashboards?.slice(0, 3);

  const styles = useStyles2(getStyles);

  const onImportDashboardClick = async (dashboard: PluginDashboard) => {
    DashboardLibraryInteractions.itemClicked({
      contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
      datasourceTypes: [dashboard.pluginId],
      libraryItemId: dashboard.uid,
      libraryItemTitle: dashboard.title,
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      eventLocation: EVENT_LOCATIONS.EMPTY_DASHBOARD,
      discoveryMethod: DISCOVERY_METHODS.BROWSE,
    });

    const params = new URLSearchParams({
      datasource: datasourceUid || '',
      title: dashboard.title || 'Template',
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      // tracking event purpose values
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      libraryItemId: dashboard.uid,
      creationOrigin: CREATION_ORIGINS.DASHBOARD_LIBRARY_DATASOURCE_DASHBOARD,
    });

    const templateUrl = `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
    locationService.push(templateUrl);
  };

  if (!templateDashboards?.length) {
    return null;
  }

  return (
    <Box borderColor="strong" borderStyle="dashed" padding={4} flex={1} data-testid="provisioned-dashboards-empty-page">
      <Stack direction="column" alignItems="center" gap={2}>
        <Text element="h3" textAlignment="center" weight="medium">
          <Trans i18nKey="dashboard.empty.start-with-suggested-dashboards">
            Start with a pre-made dashboard from your data source
          </Trans>
        </Text>
        <Box marginTop={2}>
          <Grid
            gap={4}
            columns={{
              xs: 1,
              sm: (dashboardsToShow?.length || 1) >= 2 ? 2 : 1,
              lg: (dashboardsToShow?.length || 1) >= 3 ? 3 : (dashboardsToShow?.length || 1) >= 2 ? 2 : 1,
            }}
          >
            {dashboardsToShow?.map((dashboard, index) => {
              // Use global index for consistent image assignment across pages
              const imageUrl = getProvisionedDashboardImageUrl(index);

              return (
                <TemplateDashboardBox
                  key={dashboard.uid}
                  index={index}
                  dashboard={dashboard}
                  imageUrl={imageUrl}
                  onImportClick={onImportDashboardClick}
                />
              );
            }) || []}
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
  imageUrl,
}: {
  dashboard: PluginDashboard;
  onImportClick: (d: PluginDashboard) => void;
  index: number;
  imageUrl: string;
}) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.templateDashboardBox}>
      <img src={imageUrl} width={285} height={160} alt={dashboard.title} className={styles.templateDashboardImage} />
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

function getStyles(theme: GrafanaTheme2) {
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
