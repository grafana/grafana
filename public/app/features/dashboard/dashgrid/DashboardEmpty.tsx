import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2, Text } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import { onAddLibraryPanel, onCreateNewPanel, onImportDashboard } from 'app/features/dashboard/utils/dashboard';
import { useDispatch, useSelector } from 'app/types';

import { setInitialDatasource } from '../state/reducers';

export interface Props {
  dashboard: DashboardModel;
  canCreate: boolean;
}

const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  return (
    <Flex alignItems="center" justifyContent="center">
      <div className={styles.wrapper}>
        <Flex alignItems="center" justifyContent="center" gap={4} direction="column">
          <Box borderStyle="dashed" borderColor="info" padding={4}>
            <Flex direction="column" alignItems="center" gap={2}>
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
                onClick={() => {
                  const id = onCreateNewPanel(dashboard, initialDatasource);
                  reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_visualization' });
                  locationService.partial({ editPanel: id, firstPanel: true });
                  dispatch(setInitialDatasource(undefined));
                }}
                disabled={!canCreate}
              >
                <Trans i18nKey="dashboard.empty.add-visualization-button">Add visualization</Trans>
              </Button>
            </Flex>
          </Box>
          <Flex direction="row" wrap="wrap" gap={4}>
            {config.featureToggles.vizAndWidgetSplit && (
              <Box borderStyle="dashed" borderColor="info" padding={3} grow={1}>
                <Flex direction="column" alignItems="center" gap={1}>
                  <Text element="h3" textAlignment="center" weight="medium">
                    <Trans i18nKey="dashboard.empty.add-widget-header">Add a widget</Trans>
                  </Text>
                  <Box marginBottom={2}>
                    <Text element="p" textAlignment="center" color="secondary">
                      <Trans i18nKey="dashboard.empty.add-widget-body">Create lists, markdowns and other widgets</Trans>
                    </Text>
                  </Box>
                  <Button
                    icon="plus"
                    fill="outline"
                    data-testid={selectors.pages.AddDashboard.itemButton('Create new widget button')}
                    onClick={() => {
                      reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_widget' });
                      locationService.partial({ addWidget: true });
                    }}
                    disabled={!canCreate}
                  >
                    <Trans i18nKey="dashboard.empty.add-widget-button">Add widget</Trans>
                  </Button>
                </Flex>
              </Box>
            )}
            <Box borderStyle="dashed" borderColor="info" padding={3} grow={1}>
              <Flex direction="column" alignItems="center" gap={1}>
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
                  onClick={() => {
                    reportInteraction('dashboards_emptydashboard_clicked', { item: 'import_from_library' });
                    onAddLibraryPanel(dashboard);
                  }}
                  disabled={!canCreate}
                >
                  <Trans i18nKey="dashboard.empty.add-library-panel-button">Add library panel</Trans>
                </Button>
              </Flex>
            </Box>
            <Box borderStyle="dashed" borderColor="info" padding={3} grow={1}>
              <Flex direction="column" alignItems="center" gap={1}>
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
                    reportInteraction('dashboards_emptydashboard_clicked', { item: 'import_dashboard' });
                    onImportDashboard();
                  }}
                  disabled={!canCreate}
                >
                  <Trans i18nKey="dashboard.empty.import-dashboard-button">Import dashboard</Trans>
                </Button>
              </Flex>
            </Box>
          </Flex>
        </Flex>
      </div>
    </Flex>
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
    others: css({
      width: '100%',
      label: 'others-wrapper',
      alignItems: 'stretch',
      flexDirection: 'row',
      gap: theme.spacing.gridSize * 4,

      [theme.breakpoints.down('md')]: {
        flexDirection: 'column',
      },
    }),
  };
}
