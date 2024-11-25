import { css, cx } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import NativeScrollbar from 'app/core/components/NativeScrollbar';

import { useSnappingSplitter } from '../panel-edit/splitter/useSnappingSplitter';
import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';

import { DashboardEditPaneRenderer } from './DashboardEditPane';

interface Props {
  dashboard: DashboardScene;
  isEditing?: boolean;
  body?: React.ReactNode;
  controls?: React.ReactNode;
}

export function DashboardEditPaneSplitter({ dashboard, isEditing, body, controls }: Props) {
  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight ?? 0);

  if (!config.featureToggles.dashboardNewLayouts) {
    return (
      <NativeScrollbar onSetScrollRef={dashboard.onSetScrollRef}>
        <div className={styles.canvasWrappperOld}>
          <NavToolbarActions dashboard={dashboard} />
          <div className={styles.controlsWrapperSticky}>{controls}</div>
          <div className={styles.body}>{body}</div>
        </div>
      </NativeScrollbar>
    );
  }

  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'row',
      dragPosition: 'end',
      initialSize: 0.75,
      paneOptions: {
        collapseBelowPixels: 250,
        snapOpenToPixels: 400,
      },
    });

  const containerStyle: CSSProperties = {};

  if (!isEditing) {
    primaryProps.style.flexGrow = 1;
    primaryProps.style.width = '100%';
    primaryProps.style.minWidth = 'unset';
    containerStyle.overflow = 'unset';
  }

  const onBodyRef = (ref: HTMLDivElement) => {
    dashboard.onSetScrollRef(ref);
  };

  return (
    <div {...containerProps} style={containerStyle}>
      <div {...primaryProps} className={cx(primaryProps.className, styles.canvasWithSplitter)}>
        <NavToolbarActions dashboard={dashboard} />
        <div className={cx(!isEditing && styles.controlsWrapperSticky)}>{controls}</div>
        <div className={styles.bodyWrapper}>
          <div className={cx(styles.body, isEditing && styles.bodyEditing)} ref={onBodyRef}>
            {body}
          </div>
        </div>
      </div>
      {isEditing && (
        <>
          <div {...splitterProps} data-edit-pane-splitter={true} />
          <div {...secondaryProps} className={cx(secondaryProps.className, styles.editPane)}>
            <DashboardEditPaneRenderer
              editPane={dashboard.state.editPane}
              isCollapsed={splitterState.collapsed}
              onToggleCollapse={onToggleCollapse}
            />
          </div>
        </>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2, headerHeight: number) {
  return {
    canvasWrappperOld: css({
      label: 'canvas-wrapper-old',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    canvasWithSplitter: css({
      overflow: 'unset',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    canvasWithSplitterEditing: css({
      overflow: 'unset',
    }),
    bodyWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
    }),
    body: css({
      label: 'body',
      display: 'flex',
      flexGrow: 1,
      gap: '8px',
      boxSizing: 'border-box',
      flexDirection: 'column',
      padding: theme.spacing(0.5, 2, 0.5, 2),
    }),
    bodyEditing: css({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
    }),
    editPane: css({
      flexDirection: 'column',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    controlsWrapperSticky: css({
      [theme.breakpoints.up('md')]: {
        position: 'sticky',
        zIndex: theme.zIndex.activePanel,
        background: theme.colors.background.canvas,
        top: headerHeight,
      },
    }),
  };
}
