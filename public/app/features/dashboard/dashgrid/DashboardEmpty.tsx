import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import { onAddLibraryPanel, onCreateNewPanel, onCreateNewRow } from 'app/features/dashboard/utils/dashboard';
import { useDispatch, useSelector } from 'app/types';

import { setInitialDatasource } from '../state/reducers';

export interface Props {
  dashboard: DashboardModel;
  canCreate: boolean;
}

export const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  return (
    <div className={styles.centeredContent}>
      <div className={cx(styles.centeredContent, styles.wrapper)}>
        <div className={cx(styles.containerBox, styles.centeredContent, styles.visualizationContainer)}>
          <h1 className={cx(styles.headerSection, styles.headerBig)}>
            <Trans i18nKey="dashboard.empty.add-visualization-header">
              Start your new dashboard by adding a visualization
            </Trans>
          </h1>
          <div className={cx(styles.bodySection, styles.bodyBig)}>
            <Trans i18nKey="dashboard.empty.add-visualization-body">
              Select a data source and then query and visualize your data with charts, stats and tables or create lists,
              markdowns and other widgets.
            </Trans>
          </div>
          <Button
            size="lg"
            icon="plus"
            aria-label="Add new panel"
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
            <h3 className={cx(styles.headerSection, styles.headerSmall)}>
              <Trans i18nKey="dashboard.empty.add-row-header">Add a row</Trans>
            </h3>
            <div className={cx(styles.bodySection, styles.bodySmall)}>
              <Trans i18nKey="dashboard.empty.add-row-body">Group your visualizations into expandable sections.</Trans>
            </div>
            <Button
              icon="plus"
              fill="outline"
              aria-label="Add new row"
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
            <h3 className={cx(styles.headerSection, styles.headerSmall)}>
              <Trans i18nKey="dashboard.empty.add-import-header">Import panel</Trans>
            </h3>
            <div className={cx(styles.bodySection, styles.bodySmall)}>
              <Trans i18nKey="dashboard.empty.add-import-body">
                Import visualizations that are shared with other dashboards.
              </Trans>
            </div>
            <Button
              icon="plus"
              fill="outline"
              aria-label="Add new panel from panel library"
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
    visualizationContent: css({
      gap: theme.spacing.gridSize * 2,
    }),
    headerSection: css({
      label: 'header-section',
      fontWeight: theme.typography.fontWeightMedium,
      textAlign: 'center',
    }),
    headerBig: css({
      marginBottom: theme.spacing.gridSize * 2,
    }),
    headerSmall: css({
      marginBottom: theme.spacing.gridSize,
    }),
    bodySection: css({
      label: 'body-section',
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.secondary,
      textAlign: 'center',
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
