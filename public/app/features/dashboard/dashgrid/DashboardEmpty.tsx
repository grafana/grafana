import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import {
  onAddLibraryPanel as onAddLibraryPanelImpl,
  onCreateNewPanel,
  onImportDashboard,
} from 'app/features/dashboard/utils/dashboard';
import { buildPanelEditScene } from 'app/features/dashboard-scene/panel-edit/PanelEditor';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { useDispatch, useSelector } from 'app/types';

import { setInitialDatasource } from '../state/reducers';

import DashboardTemplateImport from './DashboardTemplateImport';

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

  // HACKATHON: Implement the following functions

  const [showTemplateImportForm, setShowTemplateImportForm] = useState(false);
  const [templateDashboards, setTemplateDashboards] = useState([]);
  const [communityDashboardToImport, setCommunityDashboardToImport] = useState({});
  const [folder, setFolder] = useState({ uid: '' });

  const getCommunityDashboards = async () => {
    // fetch dashboards from grafana.com
    const gnetDashboards = (await lastValueFrom(
      getBackendSrv()
        .fetch({
          url: '/api/gnet/dashboards',
          method: 'GET',
          params: {
            pageSize: 20,
          },
        })
        .pipe(map((res) => res.data))
    )) as any;
    setTemplateDashboards(gnetDashboards.items);

    console.log('gnetDashboards', gnetDashboards);
  };

  useEffect(() => {
    getCommunityDashboards();
  }, []);

  const onImportTemplate = useCallback(
    (gnetUID: string) => {
      // fetch the dashboard from grafana.com

      getBackendSrv()
        .get(`/api/gnet/dashboards/${gnetUID}`)
        .then((dashboard) => {
          // show the import dashboard form
          console.log('dashboard from gnet to import', dashboard);
          setCommunityDashboardToImport(dashboard);
          setShowTemplateImportForm(true);
          //set intial folder
          const searchObj = locationService.getSearchObject();

          const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };
          setFolder(folder);
        });
    },
    [setShowTemplateImportForm]
  );

  const onImportDashboardTemplate = useCallback((formData: any) => {
    console.log('formData', formData);
  }, []);

  const onCancelDashboardTemplate = useCallback(() => {
    setShowTemplateImportForm(false);
  }, []);

  return (
    <Stack alignItems="center" justifyContent="center">
      <div className={styles.wrapper}>
        <Stack alignItems="stretch" justifyContent="center" gap={4} direction="column">
          <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
            <Stack direction="column" alignItems="center" gap={1}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-panel-header">Community Dashboards</Trans>
              </Text>
              {templateDashboards.length > 0 && (
                //lopp through the gcomDashboards and show them
                <Box marginBottom={2}>
                  {templateDashboards.map((gnetDash: { id: string; name: string; description: string }) => {
                    console.log('gnet dashboard', gnetDash);
                    return (
                      <div key={gnetDash.id}>
                        {gnetDash.name}
                        <Button onClick={() => onImportTemplate(gnetDash.id)} size="sm">
                          Import Template
                        </Button>
                      </div>
                    );
                  })}
                </Box>
              )}
            </Stack>
            {showTemplateImportForm && (
              <DashboardTemplateImport
                dashboard={communityDashboardToImport}
                onImport={onImportDashboardTemplate}
                onCancel={onCancelDashboardTemplate}
              />
            )}
          </Box>
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
                  disabled={!canCreate}
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
                      Import dashboards from files or <a href="https://grafana.com/grafana/dashboards/">grafana.com</a>.
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
  };
}
