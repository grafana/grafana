import { css, cx } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { SceneComponentProps, SceneObject } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import NativeScrollbar from 'app/core/components/NativeScrollbar';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getNavModel } from 'app/core/selectors/navModel';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';
import { useSelector } from 'app/types';

import { DashboardScene } from './DashboardScene';
import { NavToolbarActions } from './NavToolbarActions';
import { LayoutOptions } from './layouts/LayoutOptions';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { controls, overlay, editview, editPanel, isEmpty, meta, viewPanelScene, isEditing } = model.useState();
  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight);
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const bodyToRender = model.getBodyToRender();
  const navModel = getNavModel(navIndex, 'dashboards/browse');
  const hasControls = controls?.hasControls();
  const isSettingsOpen = editview !== undefined;

  // Remember scroll pos when going into view panel, edit panel or settings
  useMemo(() => {
    if (viewPanelScene || isSettingsOpen || editPanel) {
      model.rememberScrollPos();
    }
  }, [isSettingsOpen, editPanel, viewPanelScene, model]);

  // Restore scroll pos when coming back
  useEffect(() => {
    if (!viewPanelScene && !isSettingsOpen && !editPanel) {
      model.restoreScrollPos();
    }
  }, [isSettingsOpen, editPanel, viewPanelScene, model]);

  if (editview) {
    return (
      <>
        <editview.Component model={editview} />
        {overlay && <overlay.Component model={overlay} />}
      </>
    );
  }

  const emptyState = (
    <DashboardEmpty dashboard={model} canCreate={!!model.state.meta.canEdit} key="dashboard-empty-state" />
  );

  const withPanels = (
    <div className={cx(styles.body, !hasControls && styles.bodyWithoutControls)} key="dashboard-panels">
      <bodyToRender.Component model={bodyToRender} />
    </div>
  );

  const notFound = meta.dashboardNotFound && <EntityNotFound entity="Dashboard" key="dashboard-not-found" />;

  let body = [withPanels];

  if (notFound) {
    body = [notFound];
  } else if (isEmpty) {
    body = [emptyState, withPanels];
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Custom}>
      {editPanel && <editPanel.Component model={editPanel} />}
      {!editPanel && (
        <NativeScrollbar divId="page-scrollbar" onSetScrollRef={model.onSetScrollRef}>
          <div className={cx(styles.pageContainer)}>
            <NavToolbarActions dashboard={model} />
            {controls && (
              <div className={styles.controlsWrapper}>
                <controls.Component model={controls} />
              </div>
            )}
            {isEditing && <LayoutOptions layout={bodyToRender} scene={model} />}
            <div className={cx(styles.canvasContent)}>{body}</div>
          </div>
        </NativeScrollbar>
      )}
      {overlay && <overlay.Component model={overlay} />}
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2, headerHeight: number | undefined) {
  return {
    pageContainer: css({
      display: 'flex',
      flexGrow: 1,
      flexDirection: 'column',
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 0,
      padding: theme.spacing(2),
      ':empty': {
        display: 'none',
      },
      // Make controls sticky on larger screens (> mobile)
      [theme.breakpoints.up('md')]: {
        position: 'sticky',
        zIndex: theme.zIndex.activePanel,
        background: theme.colors.background.canvas,
        top: headerHeight,
      },
    }),
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 2),
      flexBasis: '100%',
      flexGrow: 1,
      minWidth: 0,
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
      paddingBottom: theme.spacing(2),
      boxSizing: 'border-box',
    }),
    bodyWithoutControls: css({
      paddingTop: theme.spacing(2),
    }),
  };
}
