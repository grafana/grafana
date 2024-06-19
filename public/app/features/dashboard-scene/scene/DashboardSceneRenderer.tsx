import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getNavModel } from 'app/core/selectors/navModel';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';
import { useSelector } from 'app/types';

import { DashboardScene } from './DashboardScene';
import { NavToolbarActions } from './NavToolbarActions';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { controls, overlay, editview, editPanel, isEmpty, scopes, meta } = model.useState();
  const { isExpanded: isScopesExpanded } = scopes?.useState() ?? {};
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const bodyToRender = model.getBodyToRender();
  const navModel = getNavModel(navIndex, 'dashboards/browse');
  const isHomePage = !meta.url && !meta.slug && !meta.isNew && !meta.isSnapshot;
  const hasControls = controls?.hasControls();

  if (editview) {
    return (
      <>
        <editview.Component model={editview} />
        {overlay && <overlay.Component model={overlay} />}
      </>
    );
  }

  const emptyState = <DashboardEmpty dashboard={model} canCreate={!!model.state.meta.canEdit} />;

  const withPanels = (
    <div className={cx(styles.body, !hasControls && styles.bodyWithoutControls)}>
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
        <div
          className={cx(
            styles.pageContainer,
            hasControls && !scopes && styles.pageContainerWithControls,
            scopes && styles.pageContainerWithScopes,
            scopes && isScopesExpanded && styles.pageContainerWithScopesExpanded
          )}
        >
          {scopes && !meta.dashboardNotFound && <scopes.Component model={scopes} />}
          <NavToolbarActions dashboard={model} />
          {controls && hasControls && (
            <div
              className={cx(styles.controlsWrapper, scopes && !isScopesExpanded && styles.controlsWrapperWithScopes)}
            >
              <controls.Component model={controls} />
            </div>
          )}
          <CustomScrollbar
            // This id is used by the image renderer to scroll through the dashboard
            divId="page-scrollbar"
            autoHeightMin={'100%'}
            className={styles.scrollbarContainer}
            testId={selectors.pages.Dashboard.DashNav.scrollContainer}
          >
            <div className={cx(styles.canvasContent, isHomePage && styles.homePagePadding)}>{body}</div>
          </CustomScrollbar>
        </div>
      )}
      {overlay && <overlay.Component model={overlay} />}
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pageContainer: css({
      display: 'grid',
      gridTemplateAreas: `
        "panels"`,
      gridTemplateColumns: `1fr`,
      gridTemplateRows: '1fr',
      height: '100%',
    }),
    pageContainerWithControls: css({
      gridTemplateAreas: `
        "controls"
        "panels"`,
      gridTemplateRows: 'auto 1fr',
    }),
    pageContainerWithScopes: css({
      gridTemplateAreas: `
        "scopes controls"
        "panels panels"`,
      gridTemplateColumns: `${theme.spacing(32)} 1fr`,
      gridTemplateRows: 'auto 1fr',
    }),
    pageContainerWithScopesExpanded: css({
      gridTemplateAreas: `
        "scopes controls"
        "scopes panels"`,
    }),
    scrollbarContainer: css({
      gridArea: 'panels',
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
    }),
    controlsWrapperWithScopes: css({
      padding: theme.spacing(2, 2, 2, 0),
    }),
    homePagePadding: css({
      padding: theme.spacing(2, 2),
    }),
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 2),
      flexBasis: '100%',
      flexGrow: 1,
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
