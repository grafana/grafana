import { css } from '@emotion/css';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Box, Grid, Modal, Spinner, Text, useStyles2 } from '@grafana/ui';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import { GnetDashboard, Link } from './types';

const TEMPLATE_DASHBOARD_COMMUNITY_UIDS = [24279, 24280, 24281, 24282];
const DEV_TEMPLATE_DASHBOARD_COMMUNITY_UIDS = [71, 72, 73, 74];

export const TemplateDashboardModal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get('templateDashboards') === 'true';
  const testDataSources = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' });

  const styles = useStyles2(getStyles);

  const onClose = () => {
    searchParams.delete('templateDashboards');
    setSearchParams(searchParams);
  };

  const onImportDashboardClick = async (dashboard: GnetDashboard) => {
    const params = new URLSearchParams({
      datasource: testDataSources[0].uid || '',
      title: dashboard.name,
      pluginId: testDataSources[0].type || '',
      gnetId: String(dashboard.id),
      // tracking event purpose values
      //   sourceEntryPoint: 'datasource_page',
      //   libraryItemId: dashboard.uid,
      //   creationOrigin: 'dashboard_library_datasource_dashboard',
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
          const result = await getBackendSrv().get(`/api/gnet/dashboards/${uid}`, undefined, undefined, {
            showErrorAlert: false,
          });
          return result;
        } catch (error) {
          console.error('Error loading template dashboard', uid, error);
          return null;
        }
      })
    );

    return dashboards;
  }, [isOpen]);

  const dashboards = templateDashboards?.filter((dashboard) => dashboard !== null) ?? [];

  if (testDataSources.length === 0 || (dashboards.length === 0 && !loading)) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      className={styles.modal}
      title={t('dashboard.template-dashboard-modal.title', 'Start a dashboard from a template')}
    >
      {loading ? (
        <div className={styles.loadingOverlay}>
          <Spinner />
        </div>
      ) : null}
      <Box direction="column" gap={4} display="flex">
        <Text element="p">Browse and select from a template made by Grafana</Text>
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
      </Box>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '1200px',
    }),
    resultsContainer: css({
      width: '100%',
      minHeight: '600px',
      position: 'relative',
    }),
    loadingOverlay: css({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.canvas,
      zIndex: 1,
    }),
  };
}
