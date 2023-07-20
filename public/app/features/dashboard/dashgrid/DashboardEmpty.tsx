import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/unstable';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Trans } from 'app/core/internationalization';
import { ROUTES } from 'app/features/connections/constants';
import { DashboardModel } from 'app/features/dashboard/state';
import { onAddLibraryPanel, onCreateNewPanel, onCreateNewRow } from 'app/features/dashboard/utils/dashboard';
import { useDispatch, useSelector } from 'app/types';

import { setInitialDatasource } from '../state/reducers';

export interface Props {
  dashboard: DashboardModel;
  canCreate: boolean;
}

export interface NoDataEmptyProps {
  canCreate: boolean;
}

function NoDataEmpty({ canCreate }: NoDataEmptyProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.centeredContent}>
      <div className={cx(styles.centeredContent, styles.wrapper)}>
        <div
          className={cx(styles.containerBox, styles.centeredContent, styles.visualizationContainer)}
          style={{ width: '100%' }}
        >
          <div className={styles.headerBig}>
            <Text element="h1" textAlignment="center" weight="medium">
              <Trans i18nKey="dashboard.empty.connect-data-header">Connect data</Trans>
            </Text>
          </div>
          <div className={styles.bodyBig}>
            <Text element="p" textAlignment="center" color="secondary">
              <Trans i18nKey="dashboard.empty.connect-data-body">
                Before you can build a dashboard you need to connect data.
              </Trans>
            </Text>
          </div>
          <Button
            size="lg"
            icon="plus"
            data-testid={selectors.pages.EmptyDashboardConnectData.itemButton('Connect data button')}
            onClick={() => {
              reportInteraction('dashboards_emptydashboard_clicked', { item: 'connect_data' });
              locationService.push(ROUTES.AddNewConnection);
            }}
            disabled={!canCreate}
          >
            <Trans i18nKey="dashboard.empty.connect-data-button">Connect data</Trans>
          </Button>
        </div>
        <div className={cx(styles.centeredContent, styles.others)}>
          <div className={cx(styles.containerBox, styles.centeredContent, styles.widgetContainer)}>
            <div className={styles.headerSmall}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.quick-start-a-dashboard-header">Quick start a dashboard</Trans>
              </Text>
            </div>
            <div className={styles.bodySmall}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.quick-start-a-dashboard-body">
                  Simplest & fastest way to try out Grafana Cloud with your data
                </Trans>
              </Text>
            </div>
            <Button
              fill="outline"
              data-testid={selectors.pages.AddDashboard.itemButton('Quick start a dashboard button')}
              onClick={() => {
                reportInteraction('dashboards_emptydashboard_clicked', { item: 'quickstart_a_dashboard' });
                locationService.partial({ quickstart: true });
              }}
            >
              <Trans i18nKey="dashboard.empty.quick-start-a-dashboard">Quick start a dashboard</Trans>
            </Button>
          </div>
          <div className={cx(styles.containerBox, styles.centeredContent, styles.rowContainer)}>
            <div className={styles.headerSmall}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.dashboard-demos-header">Dashboard demos</Trans>
              </Text>
            </div>
            <div className={styles.bodySmall}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.dashboard-demos-body">
                  Try Grafana dashboards capabilities on our demo page.
                </Trans>
              </Text>
            </div>
            <LinkButton
              icon="external-link-alt"
              fill="text"
              data-testid={selectors.pages.AddDashboard.itemButton('Dashboard demos button')}
              onClick={() => {
                reportInteraction('dashboards_emptydashboard_clicked', { item: 'dashboard_demos' });
              }}
              href="https://play.grafana.org/dashboards"
            >
              <Trans i18nKey="dashboard.empty.see-dashboard-demos">Go to Grafana demo page</Trans>
            </LinkButton>
          </div>
          <div className={cx(styles.containerBox, styles.centeredContent, styles.rowContainer)}>
            <div className={styles.headerSmall}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.continue-to-dashboard-header">Continue to dashboard</Trans>
              </Text>
            </div>
            <div className={styles.bodySmall}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.continue-to-dashboard-body">
                  Build a dashboard using csv or the Grafana DB.
                </Trans>
              </Text>
            </div>
            <Button
              variant="secondary"
              data-testid={selectors.pages.AddDashboard.itemButton('Build a dashboard button')}
              onClick={() => {
                reportInteraction('dashboards_emptydashboard_clicked', { item: 'build_a_dashboard' });
                locationService.partial({ buildDashboardWithoutData: true });
              }}
              disabled={!canCreate}
            >
              <Trans i18nKey="dashboard.empty.continue-to-dashboard-button">Continue to dashboard</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// TODO: Check when there is no data connected
/* function hasNoDataConnected(datasources: DataSourceInstanceSettings[]){
  const configuredConnections = datasources.filter((datasource: DataSourceInstanceSettings) => !datasource.readOnly);
  return configuredConnections.length === 0;
} */

const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);
  const [queryParams] = useQueryParams();
  const buildDashboardWithoutConnectingData = !!queryParams.buildDashboardWithoutData;

  if (!buildDashboardWithoutConnectingData) {
    return <NoDataEmpty canCreate={canCreate} />;
  }

  return (
    <div className={styles.centeredContent}>
      <div className={cx(styles.centeredContent, styles.wrapper)}>
        <div className={cx(styles.containerBox, styles.centeredContent, styles.visualizationContainer)}>
          <div className={styles.headerBig}>
            <Text element="h1" textAlignment="center" weight="medium">
              <Trans i18nKey="dashboard.empty.add-visualization-header">
                Start your new dashboard by adding a visualization
              </Trans>
            </Text>
          </div>
          <div className={styles.bodyBig}>
            <Text element="p" textAlignment="center" color="secondary">
              <Trans i18nKey="dashboard.empty.add-visualization-body">
                Select a data source and then query and visualize your data with charts, stats and tables or create
                lists, markdowns and other widgets.
              </Trans>
            </Text>
          </div>
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
        </div>
        <div className={cx(styles.centeredContent, styles.others)}>
          {config.featureToggles.vizAndWidgetSplit && (
            <div className={cx(styles.containerBox, styles.centeredContent, styles.widgetContainer)}>
              <div className={styles.headerSmall}>
                <Text element="h3" textAlignment="center" weight="medium">
                  <Trans i18nKey="dashboard.empty.add-widget-header">Add a widget</Trans>
                </Text>
              </div>
              <div className={styles.bodySmall}>
                <Text element="p" textAlignment="center" color="secondary">
                  <Trans i18nKey="dashboard.empty.add-widget-body">Create lists, markdowns and other widgets</Trans>
                </Text>
              </div>
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
            </div>
          )}
          <div className={cx(styles.containerBox, styles.centeredContent, styles.rowContainer)}>
            <div className={styles.headerSmall}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-row-header">Add a row</Trans>
              </Text>
            </div>
            <div className={styles.bodySmall}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.add-row-body">
                  Group your visualizations into expandable sections.
                </Trans>
              </Text>
            </div>
            <Button
              icon="plus"
              fill="outline"
              data-testid={selectors.pages.AddDashboard.itemButton('Create new row button')}
              onClick={() => {
                reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_row' });
                onCreateNewRow(dashboard);
              }}
              disabled={!canCreate}
            >
              <Trans i18nKey="dashboard.empty.add-row-button">Add row</Trans>
            </Button>
          </div>
          <div className={cx(styles.containerBox, styles.centeredContent, styles.libraryContainer)}>
            <div className={styles.headerSmall}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-import-header">Import panel</Trans>
              </Text>
            </div>
            <div className={styles.bodySmall}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.add-import-body">
                  Import visualizations that are shared with other dashboards.
                </Trans>
              </Text>
            </div>
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
              <Trans i18nKey="dashboard.empty.add-import-button">Import library panel</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
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
    containerBox: css({
      label: 'container-box',
      flexDirection: 'column',
      boxSizing: 'border-box',
      border: '1px dashed rgba(110, 159, 255, 0.5)',
    }),
    centeredContent: css({
      label: 'centered',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    visualizationContainer: css({
      label: 'visualization-container',
      padding: theme.spacing.gridSize * 4,
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
    widgetContainer: css({
      label: 'widget-container',
      padding: theme.spacing.gridSize * 3,
      flex: 1,
    }),
    rowContainer: css({
      label: 'row-container',
      padding: theme.spacing.gridSize * 3,
      flex: 1,
    }),
    libraryContainer: css({
      label: 'library-container',
      padding: theme.spacing.gridSize * 3,
      flex: 1,
    }),
    headerBig: css({
      marginBottom: theme.spacing.gridSize * 2,
    }),
    headerSmall: css({
      marginBottom: theme.spacing.gridSize,
    }),
    bodyBig: css({
      maxWidth: '75%',
      marginBottom: theme.spacing.gridSize * 4,
    }),
    bodySmall: css({
      marginBottom: theme.spacing.gridSize * 3,
    }),
  };
}
