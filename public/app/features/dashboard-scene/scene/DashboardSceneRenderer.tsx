import { css, cx } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { TOP_BAR_LEVEL_HEIGHT } from 'app/core/components/AppChrome/types';
import NativeScrollbar from 'app/core/components/NativeScrollbar';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getNavModel } from 'app/core/selectors/navModel';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';
import { useSelector } from 'app/types';

import { DashboardScene } from './DashboardScene';
import { NavToolbarActions, ToolbarActions } from './NavToolbarActions';
import { PanelSearchLayout } from './PanelSearchLayout';
import { DashboardAngularDeprecationBanner } from './angular/DashboardAngularDeprecationBanner';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { controls, overlay, editview, editPanel, isEmpty, meta, viewPanelScene, panelSearch, panelsPerRow } =
    model.useState();
  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight ?? 0);
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const bodyToRender = model.getBodyToRender();
  const navModel = getNavModel(navIndex, 'dashboards/browse');
  const hasControls = controls?.hasControls();
  const isSettingsOpen = editview !== undefined;
  const isSingleTopNav = config.featureToggles.singleTopNav;

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

  const angularBanner = <DashboardAngularDeprecationBanner dashboard={model} key="angular-deprecation-banner" />;

  let body: React.ReactNode = [angularBanner, withPanels];

  if (notFound) {
    body = [notFound];
  } else if (isEmpty) {
    body = [emptyState, withPanels];
  } else if (panelSearch || panelsPerRow) {
    body = <PanelSearchLayout panelSearch={panelSearch} panelsPerRow={panelsPerRow} dashboard={model} />;
  }

  return (
    <Page
      navModel={navModel}
      pageNav={pageNav}
      layout={PageLayoutType.Custom}
      toolbar={isSingleTopNav ? <ToolbarActions dashboard={model} /> : undefined}
    >
      {editPanel && <editPanel.Component model={editPanel} />}
      {!editPanel && (
        <NativeScrollbar divId="page-scrollbar" onSetScrollRef={model.onSetScrollRef}>
          <div className={cx(styles.pageContainer, hasControls && styles.pageContainerWithControls)}>
            {!isSingleTopNav && <NavToolbarActions dashboard={model} />}
            {controls && (
              <div className={styles.controlsWrapper}>
                <controls.Component model={controls} />
              </div>
            )}
            <div className={cx(styles.canvasContent)}>{body}</div>
          </div>
        </NativeScrollbar>
      )}
      {overlay && <overlay.Component model={overlay} />}
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2, headerHeight: number) {
  return {
    pageContainer: css({
      display: 'grid',
      gridTemplateAreas: `
  "panels"`,
      gridTemplateColumns: `1fr`,
      gridTemplateRows: '1fr',
      flexGrow: 1,
      [theme.breakpoints.down('sm')]: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
    pageContainerWithControls: css({
      gridTemplateAreas: `
        "controls"
        "panels"`,
      gridTemplateRows: 'auto 1fr',
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 0,
      gridArea: 'controls',
      padding: theme.spacing(2),
      ':empty': {
        display: 'none',
      },
      // Make controls sticky on larger screens (> mobile)
      [theme.breakpoints.up('md')]: {
        position: 'sticky',
        zIndex: theme.zIndex.activePanel,
        background: theme.colors.background.canvas,
        top: config.featureToggles.singleTopNav ? headerHeight + TOP_BAR_LEVEL_HEIGHT : headerHeight,
      },
    }),
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0.5, 2),
      flexBasis: '100%',
      gridArea: 'panels',
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
