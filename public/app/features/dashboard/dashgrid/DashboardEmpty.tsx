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
    <div className={styles.wrapper}>
      <div className={cx(styles.visualization, styles.containerBox)}>
        <div className={styles.headerSection}>Start your new dashboard by adding a visualization</div>
        <div className={styles.bodySection}>
          Select a data source and then query and visualize your data with charts, stats and tables or create lists,
          markdowns and other widgets
        </div>
        <div className={styles.centered}>
          <Button
            icon="plus"
            onClick={() => {
              reportInteraction('Create new panel');
              onCreateNewPanel();
            }}
          ></Button>
        </div>
      </div>
      <div className={styles.others}>
        <div className={cx(styles.rowPanel, styles.containerBox)}>
          <div className={styles.headerSection}>Add a row</div>
          <div className={styles.bodySection}>Group your visualizations into expandable sections.</div>
          <div className={styles.centered}>
            <Button
              icon="plus"
              fill="outline"
              onClick={() => {
                reportInteraction('Create new row');
                onCreateNewRow();
              }}
            ></Button>
          </div>
        </div>
        <div className={cx(styles.libPanel, styles.containerBox)}>
          <div className={styles.headerSection}>Import panel</div>
          <div className={styles.bodySection}>Import visualizations that are shared with other dashboards.</div>
          <div className={styles.centered}>
            <Button
              icon="plus"
              fill="outline"
              onClick={() => {
                reportInteraction('Add a panel from the panel library');
                onAddLibraryPanel();
              }}
            ></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: theme.spacing.gridSize * 4,
    }),
    visualization: css({}),
    headerSection: css({}),
    bodySection: css({}),
    others: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: 'row',
      gap: theme.spacing.gridSize * 4,
    }),
    rowPanel: css({}),
    libPanel: css({}),
    containerBox: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: theme.spacing.gridSize * 4,
      border: '1px dashed rgba(110, 159, 255, 0.5)',
      padding: theme.spacing.gridSize * 4,
    }),
    centered: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
  };
};
