import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Box, Grid, Modal, Text, useStyles2 } from '@grafana/ui';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import {
  DashboardLibraryInteractions,
  EVENT_LOCATIONS,
  SourceEntryPoint,
  TemplateDashboardSourceEntryPoint,
} from './interactions';
import { GnetDashboard, GnetDashboardsResponse, Link } from './types';

const SourceEntryPointMap: Record<string, SourceEntryPoint> = {
  quickAdd: TemplateDashboardSourceEntryPoint.QUICK_ADD_BUTTON,
  commandPalette: TemplateDashboardSourceEntryPoint.COMMAND_PALETTE,
  createNewButton: TemplateDashboardSourceEntryPoint.BROWSE_DASHBOARDS_PAGE,
};

export const TemplateDashboardModal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get('templateDashboards') === 'true';
  const entryPoint = searchParams.get('source') || '';

  const testDataSource = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' })[0];

  const styles = useStyles2(getStyles);

  const onClose = () => {
    searchParams.delete('templateDashboards');
    setSearchParams(searchParams);
  };

  const onPreviewDashboardClick = async (dashboard: GnetDashboard) => {
    const sourceEntryPoint = SourceEntryPointMap[entryPoint] || 'unknown';
    DashboardLibraryInteractions.itemClicked({
      contentKind: 'template_dashboard',
      datasourceTypes: [String(testDataSource?.type)],
      libraryItemId: String(dashboard.id),
      libraryItemTitle: dashboard.name,
      sourceEntryPoint,
      eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
      discoveryMethod: 'browse',
    });

    const params = new URLSearchParams({
      datasource: testDataSource?.uid || '',
      title: dashboard.name,
      pluginId: String(testDataSource?.uid) || '',
      gnetId: String(dashboard.id),
      // tracking event purpose values
      sourceEntryPoint,
      libraryItemId: String(dashboard.id),
      creationOrigin: 'template_dashboard_modal',
    });

    const templateUrl = `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
    locationService.push(templateUrl);
  };

  const { value: dashboards = [], loading } = useAsync(async () => {
    if (!isOpen) {
      return [];
    }

    try {
      const response = await getBackendSrv().get<GnetDashboardsResponse>(
        `/api/gnet/dashboards?orgSlug=raintank&categorySlug=templates&includeScreenshots=true`,
        undefined,
        undefined,
        {
          showErrorAlert: false,
        }
      );

      return response.items;
    } catch (error) {
      console.error('Error loading template dashboards ', error);
      return [];
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !loading && dashboards.length > 0) {
      DashboardLibraryInteractions.loaded({
        numberOfItems: dashboards.length,
        contentKinds: ['template_dashboard'],
        datasourceTypes: [String(testDataSource?.type)],
        sourceEntryPoint: SourceEntryPointMap[entryPoint] || 'unknown',
        eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
      });
    }
  }, [isOpen, dashboards, entryPoint, testDataSource?.type, loading]);

  if (!testDataSource || (dashboards.length === 0 && !loading)) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      className={styles.modal}
      title={t('dashboard-library.template-dashboard-modal.title', 'Start a dashboard from a template')}
      contentClassName={styles.modalContent}
    >
      <div className={styles.stickyHeader}>
        <Text element="p">
          <Trans i18nKey="dashboard-library.template-dashboard-modal.description">
            Get started with Grafana templates using sample data. Connect your data to power them with real metrics.
          </Trans>
        </Text>
      </div>
      <Box direction="column" gap={4} display="flex">
        <Grid
          gap={4}
          columns={{
            xs: 1,
            sm: 2,
            lg: 3,
          }}
        >
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <DashboardCard.Skeleton key={index} />)
            : dashboards?.map((dashboard) => {
                const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
                const thumbnailUrl = thumbnail ? `/api/gnet${thumbnail}` : '';

                return (
                  <DashboardCard
                    key={dashboard.uid}
                    title={dashboard.name}
                    imageUrl={thumbnailUrl}
                    onClick={() => onPreviewDashboardClick(dashboard)}
                    dashboard={dashboard}
                    kind="template_dashboard"
                  />
                );
              })}
        </Grid>
      </Box>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '1200px',
    }),
    stickyHeader: css({
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.colors.background.primary,
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(2),
    }),
    modalContent: css({
      paddingTop: 0,
      height: '100%',
    }),
  };
}
