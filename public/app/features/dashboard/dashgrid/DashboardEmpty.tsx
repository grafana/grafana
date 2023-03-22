import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

export interface Props {
  dashboard: DashboardModel;
  canCreate: boolean;
}

export const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const calcNewPanelGridPos = () => {
    // Move all panels down by the height of the "add panel" widget.
    // This is to work around an issue with react-grid-layout that can mess up the layout
    // in certain configurations. (See https://github.com/react-grid-layout/react-grid-layout/issues/1787)
    const addPanelWidgetHeight = 8;
    for (const panel of dashboard.panelIterator()) {
      panel.gridPos.y += addPanelWidgetHeight;
    }

    return { x: 0, y: 0, w: 12, h: addPanelWidgetHeight };
  };

  const onCreateNewPanel = () => {
    const newPanel: Partial<PanelModel> = {
      type: 'timeseries',
      title: 'Panel Title',
      gridPos: calcNewPanelGridPos(),
    };

    dashboard.addPanel(newPanel);
    locationService.partial({ editPanel: newPanel.id });
  };

  const onCreateNewRow = () => {
    const newRow = {
      type: 'row',
      title: 'Row title',
      gridPos: { x: 0, y: 0 },
    };

    dashboard.addPanel(newRow);
  };

  const onAddLibraryPanel = () => {
    const newPanel = {
      type: 'add-library-panel',
      gridPos: calcNewPanelGridPos(),
    };

    dashboard.addPanel(newPanel);
  };

  // const onPasteCopiedPanel = (panelPluginInfo: PanelPluginInfo) => {
  //   const gridPos = calcNewPanelGridPos();

  //   const newPanel = {
  //     type: panelPluginInfo.id,
  //     title: 'Panel Title',
  //     gridPos: {
  //       x: gridPos.x,
  //       y: gridPos.y,
  //       w: panelPluginInfo.defaults.gridPos.w,
  //       h: panelPluginInfo.defaults.gridPos.h,
  //     },
  //   };

  //   // apply panel template / defaults
  //   if (panelPluginInfo.defaults) {
  //     defaults(newPanel, panelPluginInfo.defaults);
  //     newPanel.title = panelPluginInfo.defaults.title;
  //     store.delete(LS_PANEL_COPY_KEY);
  //   }

  //   dashboard.addPanel(newPanel);
  // };

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.centeredContent}>
      <div className={cx(styles.centeredContent, styles.wrapper)}>
        <div className={cx(styles.containerBox, styles.centeredContent, styles.visualizationContainer)}>
          <div className={cx(styles.headerSection, styles.headerBig)}>
            Start your new dashboard by adding a visualization
          </div>
          <div className={cx(styles.bodySection, styles.bodyBig)}>
            Select a data source and then query and visualize your data with charts, stats and tables or create lists,
            markdowns and other widgets.
          </div>
          <Button
            size="lg"
            icon="plus"
            aria-label="Add new panel"
            onClick={() => {
              reportInteraction('Create new panel');
              onCreateNewPanel();
            }}
            disabled={!canCreate}
          >
            Add visualization
          </Button>
        </div>
        <div className={cx(styles.centeredContent, styles.others)}>
          <div className={cx(styles.containerBox, styles.centeredContent, styles.rowContainer)}>
            <div className={cx(styles.headerSection, styles.headerSmall)}>Add a row</div>
            <div className={cx(styles.bodySection, styles.bodySmall)}>
              Group your visualizations into expandable sections.
            </div>
            <Button
              icon="plus"
              fill="outline"
              aria-label="Add new row"
              onClick={() => {
                reportInteraction('Create new row');
                onCreateNewRow();
              }}
              disabled={!canCreate}
            >
              Add row
            </Button>
          </div>
          <div className={cx(styles.containerBox, styles.centeredContent, styles.libraryContainer)}>
            <div className={cx(styles.headerSection, styles.headerSmall)}>Import panel</div>
            <div className={cx(styles.bodySection, styles.bodySmall)}>
              Import visualizations that are shared with other dashboards.
            </div>
            <Button
              icon="plus"
              fill="outline"
              aria-label="Add new panel from panel library"
              onClick={() => {
                reportInteraction('Add a panel from the panel library');
                onAddLibraryPanel();
              }}
              disabled={!canCreate}
            >
              Import library panel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'dashboard-empty-wrapper',
      flexDirection: 'column',
      maxWidth: '920px',
      gap: theme.spacing.gridSize * 4,
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
      fontWeight: 600,
    }),
    headerBig: css({
      fontSize: '32px',
      lineHeight: '48px',
      marginBottom: theme.spacing.gridSize * 2,
    }),
    headerSmall: css({
      fontSize: '24px',
      lineHeight: '32px',
      marginBottom: theme.spacing.gridSize,
    }),
    bodySection: css({
      label: 'body-section',
      fontWeight: theme.typography.fontWeightRegular,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    }),
    bodyBig: css({
      fontSize: '20px',
      maxWidth: '75%',
      marginBottom: theme.spacing.gridSize * 4,
    }),
    bodySmall: css({
      fontSize: '16px',
      marginBottom: theme.spacing.gridSize * 3,
    }),
  };
};
