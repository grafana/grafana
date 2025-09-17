import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, TextLink, Divider } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import {
  onAddLibraryPanel as onAddLibraryPanelImpl,
  onCreateNewPanel,
  onImportDashboard,
} from 'app/features/dashboard/utils/dashboard';
import { buildPanelEditScene } from 'app/features/dashboard-scene/panel-edit/PanelEditor';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { dispatch } from 'app/store/store';
import { PluginDashboard } from 'app/types/plugins';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { setInitialDatasource } from '../state/reducers';

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const [queryParams] = useQueryParams();
  console.log('queryParams', queryParams);
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  console.log('initialDatasource', initialDatasource);

  const [provisionedDashboards, setProvisionedDashboards] = useState<PluginDashboard[]>([]);

  useEffect(() => {
    if (queryParams.provisionedDatasource) {
      const url = `api/plugins/${queryParams.provisionedDatasource}/dashboards`;

      getBackendSrv()
        .get(url)
        .then((res: PluginDashboard[]) => {
          setProvisionedDashboards(res);
        });
    }
  }, [queryParams.provisionedDatasource]);

  console.log('provisionedDashboards', provisionedDashboards);

  const onAddVisualization = () => {
    let id;
    if (dashboard instanceof DashboardScene) {
      const panel = dashboard.onCreateNewPanel();
      dashboard.setState({ editPanel: buildPanelEditScene(panel, true) });
      locationService.partial({ firstPanel: true });
    } else {
      id = onCreateNewPanel(dashboard, initialDatasource);
      dispatch(setInitialDatasource(undefined));
      locationService.partial({ editPanel: id, firstPanel: true });
    }

    DashboardInteractions.emptyDashboardButtonClicked({ item: 'add_visualization' });
  };

  const onAddLibraryPanel = () => {
    DashboardInteractions.emptyDashboardButtonClicked({ item: 'import_from_library' });
    if (dashboard instanceof DashboardScene) {
      dashboard.onShowAddLibraryPanelDrawer();
    } else {
      onAddLibraryPanelImpl(dashboard);
    }
  };

  const isProvisioned = dashboard instanceof DashboardScene && dashboard.isManagedRepository();
  return (
    <Stack alignItems="center" justifyContent="center">
      <div className={styles.wrapper}>
        <Stack alignItems="stretch" justifyContent="center" gap={4} direction="column">
          <Box borderColor="strong" borderStyle="dashed" padding={4}>
            <Stack direction="column" alignItems="center" gap={2}>
              <Text element="h1" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-visualization-header">
                  Start your new dashboard by adding a visualization
                </Trans>
              </Text>
              <Box marginBottom={2} paddingX={4}>
                <Text element="p" textAlignment="center" color="secondary">
                  <Trans i18nKey="dashboard.empty.add-visualization-body">
                    Select a data source and then query and visualize your data with charts, stats and tables or create
                    lists, markdowns and other widgets.
                  </Trans>
                </Text>
              </Box>
              <Button
                size="lg"
                icon="plus"
                data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
                onClick={onAddVisualization}
                disabled={!canCreate}
              >
                <Trans i18nKey="dashboard.empty.add-visualization-button">Add visualization</Trans>
              </Button>
            </Stack>
          </Box>
          <ProvisionedDashboardsSection />
          <Stack direction={{ xs: 'column', md: 'row' }} wrap="wrap" gap={4}>
            <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
              <Stack direction="column" alignItems="center" gap={1}>
                <Text element="h3" textAlignment="center" weight="medium">
                  <Trans i18nKey="dashboard.empty.add-library-panel-header">Import panel</Trans>
                </Text>
                <Box marginBottom={2}>
                  <Text element="p" textAlignment="center" color="secondary">
                    <Trans i18nKey="dashboard.empty.add-library-panel-body">
                      Add visualizations that are shared with other dashboards.
                    </Trans>
                  </Text>
                </Box>
                <Button
                  icon="plus"
                  fill="outline"
                  data-testid={selectors.pages.AddDashboard.itemButton('Add a panel from the panel library button')}
                  onClick={onAddLibraryPanel}
                  disabled={!canCreate || isProvisioned}
                >
                  <Trans i18nKey="dashboard.empty.add-library-panel-button">Add library panel</Trans>
                </Button>
              </Stack>
            </Box>
            <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
              <Stack direction="column" alignItems="center" gap={1}>
                <Text element="h3" textAlignment="center" weight="medium">
                  <Trans i18nKey="dashboard.empty.import-a-dashboard-header">Import a dashboard</Trans>
                </Text>
                <Box marginBottom={2}>
                  <Text element="p" textAlignment="center" color="secondary">
                    <Trans i18nKey="dashboard.empty.import-a-dashboard-body">
                      Import dashboards from files or{' '}
                      <TextLink external href="https://grafana.com/grafana/dashboards/">
                        grafana.com
                      </TextLink>
                      .
                    </Trans>
                  </Text>
                </Box>
                <Button
                  icon="upload"
                  fill="outline"
                  data-testid={selectors.pages.AddDashboard.itemButton('Import dashboard button')}
                  onClick={() => {
                    DashboardInteractions.emptyDashboardButtonClicked({ item: 'import_dashboard' });
                    onImportDashboard();
                  }}
                  disabled={!canCreate}
                >
                  <Trans i18nKey="dashboard.empty.import-dashboard-button">Import dashboard</Trans>
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </div>
    </Stack>
  );
};

export default DashboardEmpty;

const ProvisionedDashboardsSection = () => {
  const [queryParams] = useQueryParams();
  console.log('queryParams', queryParams);
  const navigate = useNavigate();

  const [provisionedDashboards, setProvisionedDashboards] = useState<PluginDashboard[]>([]);

  useEffect(() => {
    if (queryParams.provisionedDatasource) {
      getProvisionedDashboards(queryParams.provisionedDatasource as string);
    }
  }, [queryParams.provisionedDatasource]);

  const getProvisionedDashboards = (type: string) => {
    const url = `api/plugins/${type}/dashboards`;

    getBackendSrv()
      .get(url)
      .then((res: PluginDashboard[]) => {
        setProvisionedDashboards(res);
      });
  };

  const onImportDashboardClick = async (dashboard: PluginDashboard) => {
    const data = {
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      overwrite: false,
      inputs: [
        {
          name: '*',
          type: 'datasource',
          pluginId: queryParams.provisionedDatasource,
          value: queryParams.provisionedDatasourceName,
        },
      ],
    };
    const rs = await getBackendSrv().post('/api/dashboards/import', data);
    dispatch(notifyApp(createSuccessNotification('Dashboard Imported', dashboard.title)));
    navigate(rs.importedUrl);
  };

  return (
    <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
      <Stack direction="column" alignItems="center" gap={2}>
        <Text element="h3" textAlignment="center" weight="medium">
          <Trans i18nKey="dashboard.empty.import-a-dashboard-heasfaader">Start from template dashboards</Trans>
        </Text>
        <Stack gap={2} justifyContent="space-between">
          {provisionedDashboards.map((dashboard) => (
            <ProvisionedDashboardBox key={dashboard.uid} dashboard={dashboard} onImportClick={onImportDashboardClick} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};

const ProvisionedDashboardBox = ({
  dashboard,
  onImportClick,
}: {
  dashboard: PluginDashboard;
  onImportClick: (d: PluginDashboard) => void;
}) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.provisionedDashboardBox}>
      <img src="https://grafana.com/api/dashboards/1860/images/7994/thumbnail" width={190} alt={dashboard.title} />
      <Divider spacing={0} />
      <div className={styles.privisionedDashboardSection}>
        <Text element="p" textAlignment="center" color="secondary">
          {dashboard.title}
        </Text>
        <Button
          fill="outline"
          data-testid={selectors.pages.AddDashboard.itemButton('Import dashboard button')}
          // onClick={() => {
          //   DashboardInteractions.emptyDashboardButtonClicked({ item: 'import_dashboard' });
          //   onImportDashboard();
          // }}
          onClick={() => onImportClick(dashboard)}
          // disabled={!canCreate}
        >
          <Trans i18nKey="dashboard.empty.import-dashboaasard-button">Use template</Trans>
        </Button>
      </div>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      label: 'dashboard-empty-wrapper',
      flexDirection: 'column',
      maxWidth: '890px',
      gap: theme.spacing.gridSize * 4,
      paddingTop: theme.spacing(2),

      [theme.breakpoints.up('sm')]: {
        paddingTop: theme.spacing(12),
      },
    }),
    privisionedDashboardSection: css({
      margin: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      alignItems: 'center',
    }),
    provisionedDashboardBox: css({
      display: 'flex',
      paddingBottom: theme.spacing(1),
      border: `1px solid ${theme.colors.border.strong}`,
      borderRadius: 4,
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
}
