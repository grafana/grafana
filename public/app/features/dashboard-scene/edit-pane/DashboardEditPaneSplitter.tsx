import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { useSceneObjectState } from '@grafana/scenes';
import { ElementSelectionContext, useSidebar, useStyles2, Sidebar } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import NativeScrollbar, { DivScrollElement } from 'app/core/components/NativeScrollbar';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { PublicDashboardBadge } from '../scene/new-toolbar/actions/PublicDashboardBadge';
import { StarButton } from '../scene/new-toolbar/actions/StarButton';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardEditPaneRenderer } from './DashboardEditPaneRenderer';

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
  const hasUid = Boolean(dashboard.state.uid);
  const canStar = Boolean(dashboard.state.meta.canStar);

  //const [isCollapsed, setIsCollapsed] = useEditPaneCollapsed();

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

  const { selectionContext, openPane } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });

  const onBodyRef = (ref: HTMLDivElement | null) => {
    if (ref) {
      dashboard.onSetScrollRef(new DivScrollElement(ref));
    }
  };

  const sidebarContext = useSidebar({
    hasOpenPane: Boolean(openPane),
    contentMargin: 1,
    position: 'right',
    persistanceKey: 'dashboard',
    onClosePane: () => editPane.closePane(),
  });

  /**
   * Sync docked state to editPane state
   */
  useEffect(() => {
    editPane.setState({ isDocked: sidebarContext.isDocked });
  }, [sidebarContext.isDocked, editPane]);

  const onClearSelection: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    if (evt.shiftKey) {
      return;
    }

    editPane.clearSelection();
  };

  return (
    <div className={styles.container}>
      <ElementSelectionContext.Provider value={selectionContext}>
        <AppChromeUpdate
          breadcrumbActions={
            <>
              {hasUid && canStar && <StarButton dashboard={dashboard} />}
              {hasUid && canStar && <PublicDashboardBadge dashboard={dashboard} />}
              {renderDynamicNavActions()}
            </>
          }
        />
        <div className={cx(styles.controlsWrapperSticky)} onPointerDown={onClearSelection}>
          {controls}
        </div>
        <div className={styles.bodyWrapper} {...sidebarContext.outerWrapperProps}>
          <div
            className={styles.bodyWithToolbar}
            data-testid={selectors.components.DashboardEditPaneSplitter.primaryBody}
            ref={onBodyRef}
            onPointerDown={onClearSelection}
          >
            {body}
          </div>
          <Sidebar contextValue={sidebarContext}>
            <DashboardEditPaneRenderer editPane={editPane} dashboard={dashboard} isDocked={sidebarContext.isDocked} />
          </Sidebar>
        </div>
      </ElementSelectionContext.Provider>
    </div>
  );
}

function renderDynamicNavActions() {
  const dashboard = getDashboardSrv().getCurrent()!;
  const showProps = { dashboard };

  return dynamicDashNavActions.left.map((action, index) => {
    if (action.show(showProps)) {
      const ActionComponent = action.component;
      return <ActionComponent key={index} dashboard={dashboard} />;
    }
    return null;
  });
}

function getStyles(theme: GrafanaTheme2, headerHeight: number) {
  return {
    canvasWrappperOld: css({
      label: 'canvas-wrapper-old',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    container: css({
      label: 'container',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
    }),
    bodyWrapper: css({
      label: 'body-wrapper',
      display: 'flex',
      flexDirection: 'row',
      flexGrow: 1,
      position: 'relative',
      flex: '1 1 0',
      overflow: 'hidden',
    }),
    bodyWithToolbar: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarGutter: 'stable',
      // without top padding the fixed controls headers is rendered over the selection outline.
      padding: theme.spacing(0.125, 1, 2, 2),
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
