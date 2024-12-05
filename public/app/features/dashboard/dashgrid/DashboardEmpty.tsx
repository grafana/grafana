import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, Grid, LinkButton } from '@grafana/ui';
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
import { TemplateItem } from 'app/features/manage-dashboards/templates-catalog/TemplateItem';
import { useTemplateDashboards } from 'app/features/manage-dashboards/templates-catalog/hooks';
import { useDispatch, useSelector } from 'app/types';

import { setInitialDatasource } from '../state/reducers';

import DashboardTemplateImport from './DashboardTemplateImport';

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

const DEFAULT_VARIABLES_TO_USE_AS_TEMPLATE = ['11350', '10991', '14584'];

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
  const [communityDashboardToImportUID, setCommunityDashboardToImportUID] = useState('');
  const { dashboards } = useTemplateDashboards({
    pageSize: 3,
    filterByIds: DEFAULT_VARIABLES_TO_USE_AS_TEMPLATE,
  });

  const onImportTemplate = useCallback((gnetUID: string) => {
    //show the import dashboard form
    // change the url to /dashboard/import?gnetUID=123
    setCommunityDashboardToImportUID(gnetUID);
    setShowTemplateImportForm(true);
  }, []);

  const onCancelDashboardTemplate = useCallback(() => {
    setShowTemplateImportForm(false);
  }, []);

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
          <Box borderColor="strong" borderStyle="dashed" gap={2} flex={1} padding={4}>
            <Stack direction="column" alignItems="center" gap={1}>
              <Text element="h1" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.use-a-template-header">Use a template from our template catalog</Trans>
              </Text>
              <Box marginBottom={2} paddingX={4}>
                <Text element="p" textAlignment="center" color="secondary">
                  <Trans i18nKey="dashboard.empty.use-a-template-body">
                    Use your organization templates or the community templates to get started quickly.
                  </Trans>
                </Text>
              </Box>
              {dashboards && dashboards.length > 0 && (
                <Box marginBottom={2}>
                  <Grid columns={3} gap={2} alignItems="stretch">
                    {dashboards.map((d) => (
                      <TemplateItem
                        key={d.slug}
                        dashboard={d}
                        compact
                        onClick={() => {
                          onImportTemplate(String(d.id));
                        }}
                      />
                    ))}
                  </Grid>
                </Box>
              )}
              <LinkButton fill="text" size="lg" href="/dashboard/import">
                See all templates &gt;
              </LinkButton>
            </Stack>
            {showTemplateImportForm && (
              <DashboardTemplateImport
                dashboardUid={communityDashboardToImportUID}
                onCancel={onCancelDashboardTemplate}
              />
            )}
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
    }),
  };
}
