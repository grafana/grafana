import { css, cx } from '@emotion/css';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { TOP_BAR_LEVEL_HEIGHT } from 'app/core/components/AppChrome/types';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getNavModel } from 'app/core/selectors/navModel';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';
import { useSelector } from 'app/types';

import { DashboardScene } from './DashboardScene';
import { NavToolbarActions, ToolbarActions } from './NavToolbarActions';
import { PanelSearchLayout } from './PanelSearchLayout';
import { DashboardAngularDeprecationBanner } from './angular/DashboardAngularDeprecationBanner';

function DashboardSceneRendererBody({ model }: SceneComponentProps<DashboardScene>) {
  const { controls, isEmpty, meta, panelSearch, panelsPerRow } =
    model.useState();
  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight ?? 0);
  const bodyToRender = model.getBodyToRender();
  const hasControls = controls?.hasControls();

  if (meta.dashboardNotFound) {
    return <EntityNotFound entity="Dashboard" key="dashboard-not-found" />;
  }

  if (isEmpty) {
    return (
      <>
        <DashboardEmpty dashboard={model} canCreate={!!model.state.meta.canEdit} key="dashboard-empty-state" />
        <div className={cx(styles.body, !hasControls && styles.bodyWithoutControls)} key="dashboard-panels">
          <bodyToRender.Component model={bodyToRender} />
        </div>
      </>
    );
  }

  if (panelSearch || panelsPerRow) {
    return <PanelSearchLayout panelSearch={panelSearch} panelsPerRow={panelsPerRow} dashboard={model} />;
  }

  return (
    <>
      <DashboardAngularDeprecationBanner dashboard={model} key="angular-deprecation-banner" />
      <div className={cx(styles.body, !hasControls && styles.bodyWithoutControls)} key="dashboard-panels">
        <bodyToRender.Component model={bodyToRender} />
      </div>
    </>
  );
}

function DashboardSceneRendererContent({ model }: SceneComponentProps<DashboardScene>) {
  const { controls } = model.useState();
  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight ?? 0);
  const hasControls = controls?.hasControls();
  const isSingleTopNav = config.featureToggles.singleTopNav;

  return (
    <div className={cx(styles.pageContainer, hasControls && styles.pageContainerWithControls)}>
      {!isSingleTopNav && <NavToolbarActions dashboard={model} />}
      {controls && (
        <div className={styles.controlsWrapper}>
          <controls.Component model={controls} />
        </div>
      )}
      <div className={cx(styles.canvasContent)}>
        <DashboardSceneRendererBody model={model} />
      </div>
    </div>
  );
}

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { overlay, editview, editPanel, viewPanelScene } = model.useState();
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const navModel = getNavModel(navIndex, 'dashboards/browse');
  const isSettingsOpen = editview !== undefined;
  const isSingleTopNav = config.featureToggles.singleTopNav;

  // Remember scroll pos when going into view panel, edit panel or settings
  useEffect(() => {
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

  return (
    <Page
      navId={'dashboard-scene-renderer'}
      navModel={navModel}
      pageNav={pageNav}
      layout={PageLayoutType.Custom}
      toolbar={isSingleTopNav ? <ToolbarActions dashboard={model} /> : undefined}
    >
      {editPanel && <editPanel.Component model={editPanel} />}
      {!editPanel && (
        <DashboardSceneRendererContent model={model} />
      )}
      {overlay && <overlay.Component model={overlay} />}
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2, headerHeight: number) {
  return {
    pageContainer: css({
      label: 'page-container-dashboard-scene-renderer',
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
      label: 'canvas-content-dashboard-scene-renderer',
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
