import { css, cx } from '@emotion/css';
import React, { CSSProperties, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { useSceneObjectState } from '@grafana/scenes';
import { ElementSelectionContext, useStyles2 } from '@grafana/ui';
import NativeScrollbar, { DivScrollElement } from 'app/core/components/NativeScrollbar';

import { useSnappingSplitter } from '../panel-edit/splitter/useSnappingSplitter';
import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';

import { DashboardEditPaneRenderer } from './DashboardEditPaneRenderer';
import { useEditPaneCollapsed } from './shared';

interface Props {
  dashboard: DashboardScene;
  isEditing?: boolean;
  body?: React.ReactNode;
  controls?: React.ReactNode;
}

export function DashboardEditPaneSplitter({ dashboard, isEditing, body, controls }: Props) {
  const headerHeight = useChromeHeaderHeight();
  const { editPane } = dashboard.state;
  const styles = useStyles2(getStyles, headerHeight ?? 0);
  const [isCollapsed, setIsCollapsed] = useEditPaneCollapsed();

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
      initialSize: 330,
      handleSize: 'sm',
      usePixels: true,
      collapseBelowPixels: 250,
      collapsed: isCollapsed,
    });

  useEffect(() => {
    setIsCollapsed(splitterState.collapsed);
  }, [splitterState.collapsed, setIsCollapsed]);

  /**
   * Enable / disable selection based on dashboard isEditing state
   */
  useEffect(() => {
    if (isEditing) {
      editPane.enableSelection();
    } else {
      editPane.disableSelection();
    }
  }, [isEditing, editPane]);

  const { selectionContext } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  const containerStyle: CSSProperties = {};

  if (!isEditing) {
    primaryProps.style.flexGrow = 1;
    primaryProps.style.width = '100%';
    primaryProps.style.minWidth = 'unset';
    containerStyle.overflow = 'unset';
  }

  const onBodyRef = (ref: HTMLDivElement | null) => {
    if (ref) {
      dashboard.onSetScrollRef(new DivScrollElement(ref));
    }
  };

  return (
    <div {...containerProps} style={containerStyle}>
      <ElementSelectionContext.Provider value={selectionContext}>
        <div
          {...primaryProps}
          className={cx(primaryProps.className, styles.canvasWithSplitter)}
          onPointerDown={(evt) => {
            if (evt.shiftKey) {
              return;
            }

            editPane.clearSelection();
          }}
        >
          <NavToolbarActions dashboard={dashboard} />
          <div className={cx(!isEditing && styles.controlsWrapperSticky)}>{controls}</div>
          <div className={styles.bodyWrapper}>
            <div
              className={cx(styles.body, isEditing && styles.bodyEditing)}
              data-testid={selectors.components.DashboardEditPaneSplitter.primaryBody}
              ref={onBodyRef}
            >
              {body}
            </div>
          </div>
        </div>
        {isEditing && (
          <>
            <div
              {...splitterProps}
              className={cx(splitterProps.className, styles.splitter)}
              data-edit-pane-splitter={true}
            />
            <div {...secondaryProps} className={cx(secondaryProps.className, styles.editPane)}>
              <DashboardEditPaneRenderer
                editPane={editPane}
                isEditPaneCollapsed={isCollapsed}
                onToggleCollapse={onToggleCollapse}
                openOverlay={selectionContext.selected.length > 0}
              />
            </div>
          </>
        )}
      </ElementSelectionContext.Provider>
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
      label: 'body-wrapper',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
    }),
    body: css({
      label: 'body',
      display: 'flex',
      flexGrow: 1,
      gap: theme.spacing(1),
      boxSizing: 'border-box',
      flexDirection: 'column',
      // without top padding the fixed controls headers is rendered over the selection outline.
      padding: theme.spacing(0.125, 2, 2, 2),
    }),
    bodyEditing: css({
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarGutter: 'stable',
      // Because the edit pane splitter handle area adds padding we can reduce it here
      paddingRight: theme.spacing(1),
    }),
    editPane: css({
      flexDirection: 'column',
      // borderLeft: `1px solid ${theme.colors.border.weak}`,
      // background: theme.colors.background.primary,
    }),
    splitter: css({
      '&:after': {
        display: 'none',
      },
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
