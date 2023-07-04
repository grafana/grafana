import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { H1, H3, P } from '@grafana/ui/src/unstable';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import { onAddLibraryPanel, onCreateNewPanel, onCreateNewRow } from 'app/features/dashboard/utils/dashboard';
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
    <div className={styles.centeredContent}>
      <div className={cx(styles.centeredContent, styles.wrapper)}>
        <div className={cx(styles.containerBox, styles.centeredContent, styles.visualizationContainer)}>
          <div className={styles.headerBig}>
            <H1 textAlignment="center" weight="medium">
              <Trans i18nKey="dashboard.empty.add-visualization-header">
                Start your new dashboard by adding a visualization
              </Trans>
            </H1>
          </div>
          <div className={styles.bodyBig}>
            <P textAlignment="center" color="secondary">
              <Trans i18nKey="dashboard.empty.add-visualization-body">
                Select a data source and then query and visualize your data with charts, stats and tables or create
                lists, markdowns and other widgets.
              </Trans>
            </P>
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
          <div className={cx(styles.containerBox, styles.centeredContent, styles.rowContainer)}>
            <div className={styles.headerSmall}>
              <H3 textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-row-header">Add a row</Trans>
              </H3>
            </div>
            <div className={styles.bodySmall}>
              <P textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.add-row-body">
                  Group your visualizations into expandable sections.
                </Trans>
              </P>
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
              <H3 textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-import-header">Import panel</Trans>
              </H3>
            </div>
            <div className={styles.bodySmall}>
              <P textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.add-import-body">
                  Import visualizations that are shared with other dashboards.
                </Trans>
              </P>
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
      label: 'others-wrapper',
      alignItems: 'stretch',
      flexDirection: 'row',
      gap: theme.spacing.gridSize * 4,

      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column',
      },
    }),
    rowContainer: css({
      label: 'row-container',
      padding: theme.spacing.gridSize * 3,
    }),
    libraryContainer: css({
      label: 'library-container',
      padding: theme.spacing.gridSize * 3,
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
