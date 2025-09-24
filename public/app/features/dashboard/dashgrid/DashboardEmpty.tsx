import { css } from '@emotion/css';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, TextLink, Divider, Spinner } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import {
  onAddLibraryPanel as onAddLibraryPanelImpl,
  onCreateNewPanel,
  onImportDashboard,
} from 'app/features/dashboard/utils/dashboard';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { buildPanelEditScene } from 'app/features/dashboard-scene/panel-edit/PanelEditor';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { dispatch } from 'app/store/store';
import { DashboardDTO } from 'app/types/dashboard';
import { PluginDashboard } from 'app/types/plugins';
import { useDispatch, useSelector } from 'app/types/store';

import { setInitialDatasource } from '../state/reducers';

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

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
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  const { value: provisionedDashboards, loading: isProvisionedLoading } = useAsync(async (): Promise<
    PluginDashboard[]
  > => {
    if (!initialDatasource) {
      return [];
    }
    const ds = getDataSourceSrv().getInstanceSettings(initialDatasource);
    if (!ds) {
      return [];
    }
    return await getBackendSrv().get(`api/plugins/${ds.type}/dashboards`);
  }, [initialDatasource]);

  const onImportDashboardClick = async (dashboard: PluginDashboard) => {
    const data = {
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      overwrite: true,
      inputs: [
        {
          name: '*',
          type: 'datasource',
          pluginId: dashboard.pluginId,
          value: initialDatasource,
        },
      ],
    };

    try {
      const interpolatedDashboard = await getBackendSrv().post('/api/dashboards/interpolate', data);
      const dashboardDTO: DashboardDTO = {
        dashboard: {
          ...interpolatedDashboard,
          // necessary to ensure the dashboard is saved as a new dashboard and correct form is displayed
          uid: '',
          version: 0,
          id: null,
        },
        meta: {
          canSave: true,
          canEdit: true,
          canStar: false,
          canShare: false,
          canDelete: false,
          isNew: true,
          folderUid: '',
        },
      };

      const dashboardScene = transformSaveModelToScene(dashboardDTO);
      dashboardScene.setInitialSaveModel(dashboardDTO.dashboard, dashboardDTO.meta);
      dashboardScene.onEnterEditMode();

      // mark the dashboard as dirty to ensure it shows the "Save As" form
      dashboardScene.setState({ isDirty: true });

      const stateManager = getDashboardScenePageStateManager();
      stateManager.setState({ dashboard: dashboardScene, isLoading: false });

      dispatch(notifyApp(createSuccessNotification('Provisioned dashboard loaded', dashboard.title)));
    } catch (error) {
      console.error('Error importing dashboard:', error);
      dispatch(notifyApp(createSuccessNotification('Failed to load dashboard', '')));
    }
  };

  if (!provisionedDashboards?.length && !isProvisionedLoading) {
    return null;
  }

  return (
    <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
      <Stack direction="column" alignItems="center" gap={2}>
        <Text element="h3" textAlignment="center" weight="medium">
          <Trans i18nKey="dashboard.empty.import-a-dashboard-heasfaader">Start with suggested dashboards</Trans>
        </Text>
        {isProvisionedLoading ? (
          <Spinner />
        ) : (
          <Stack gap={2} justifyContent="space-between">
            {provisionedDashboards?.map((dashboard, index) => (
              <ProvisionedDashboardBox
                key={dashboard.uid}
                index={index}
                dashboard={dashboard}
                onImportClick={onImportDashboardClick}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

const ProvisionedDashboardBox = ({
  dashboard,
  onImportClick,
  index,
}: {
  dashboard: PluginDashboard;
  onImportClick: (d: PluginDashboard) => void;
  index: number;
}) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.provisionedDashboardBox}>
      <img
        src={
          index % 2 === 0
            ? 'https://grafana.com/api/dashboards/11350/images/7248/image'
            : 'https://grafana.com/api/dashboards/10991/images/7003/image'
        }
        width={190}
        height={160}
        alt={dashboard.title}
      />
      <Divider spacing={0} />
      <div className={styles.privisionedDashboardSection}>
        <Text element="p" textAlignment="center" color="secondary">
          {dashboard.title}
        </Text>
        <Button fill="outline" onClick={() => onImportClick(dashboard)}>
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
      borderRadius: theme.shape.radius.default,
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
}
