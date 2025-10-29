import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Box, Grid, Modal, Spinner, Text, useStyles2 } from '@grafana/ui';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import { DashboardLibraryInteractions, TemplateDashboardSourceEntryPoint } from './interactions';
import { GnetDashboard, Link } from './types';

const TEMPLATE_DASHBOARD_COMMUNITY_UIDS = [24279, 24280, 24281, 24282];
const DEV_TEMPLATE_DASHBOARD_COMMUNITY_UIDS = [71, 72, 73, 74];

const SourceEntryPointMap: Record<string, TemplateDashboardSourceEntryPoint> = {
  quickAdd: 'quick_add_button',
  commandPalette: 'command_palette',
  createNewButton: 'dashboard_list_page_create_new_button',
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

  const onImportDashboardClick = async (dashboard: GnetDashboard) => {
    const sourceEntryPoint = SourceEntryPointMap[entryPoint] || 'unknown';
    DashboardLibraryInteractions.itemClicked({
      contentKind: 'template_dashboard',
      datasourceTypes: [String(testDataSource?.type)],
      libraryItemId: String(dashboard.id),
      libraryItemTitle: dashboard.name,
      sourceEntryPoint,
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

  const { value: templateDashboards, loading } = useAsync(async () => {
    if (!isOpen) {
      return [];
    }
    const dashboards = await Promise.all(
      [...TEMPLATE_DASHBOARD_COMMUNITY_UIDS, ...DEV_TEMPLATE_DASHBOARD_COMMUNITY_UIDS].map(async (uid) => {
        try {
          return await getBackendSrv().get(`/api/gnet/dashboards/${uid}`, undefined, undefined, {
            showErrorAlert: false,
          });
        } catch (error) {
          console.error('Error loading template dashboard', uid, error);
          return null;
        }
      })
    );

    return dashboards;
  }, [isOpen]);

  const dashboards = useMemo(
    () => templateDashboards?.filter((dashboard) => dashboard !== null) ?? [],
    [templateDashboards]
  );

  useEffect(() => {
    if (isOpen && !loading) {
      DashboardLibraryInteractions.loaded({
        numberOfItems: dashboards.length,
        contentKinds: ['template_dashboard'],
        datasourceTypes: [String(testDataSource?.type)],
        sourceEntryPoint: SourceEntryPointMap[entryPoint] || 'unknown',
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
    >
      <Box direction="column" gap={4} display="flex">
        <Text element="p">
          <Trans i18nKey="dashboard-library.template-dashboard-modal.description">
            Browse and select from a template made by Grafana
          </Trans>
        </Text>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <Spinner />
          </Box>
        ) : (
          <Grid
            gap={4}
            columns={{
              xs: 1,
              sm: 2,
              lg: 3,
            }}
          >
            {dashboards?.map((dashboard) => {
              const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
              const thumbnailUrl = thumbnail ? `/api/gnet${thumbnail}` : '';

              return (
                <DashboardCard
                  key={dashboard.uid}
                  title={dashboard.name}
                  imageUrl={thumbnailUrl}
                  onClick={() => onImportDashboardClick(dashboard)}
                  dashboard={dashboard}
                />
              );
            })}
          </Grid>
        )}
      </Box>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '1200px',
    }),
  };
}
