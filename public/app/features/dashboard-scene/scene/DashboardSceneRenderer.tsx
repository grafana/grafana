import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type SceneComponentProps } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { useSelector } from 'app/types/store';

import { DashboardSidebarSplitter } from '../sidebar/DashboardSidebarSplitter';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from '../solo/SoloPanelContext';

import { type DashboardScene } from './DashboardScene';
import { PanelSearchLayout } from './PanelSearchLayout';
import { PlanningControls } from './new-toolbar/PlanningControls';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const {
    controls,
    overlay,
    editview,
    body,
    editPanel,
    viewPanel,
    panelSearch,
    panelsPerRow,
    isEditing,
    layoutOrchestrator,
    planning,
  } = model.useState();

  const scopesServices = useScopesServices();

  // Disable scope redirects while in edit mode so users aren't navigated away mid-edit.
  // Also close the scopes dashboards drawer while editing and restore it on exit.
  useEffect(() => {
    scopesServices?.scopesSelectorService.setRedirectEnabled(!isEditing);

    const drawerWasOpen = Boolean(isEditing && scopesServices?.scopesDashboardsService.state.drawerOpened);
    if (drawerWasOpen) {
      scopesServices?.scopesDashboardsService.toggleDrawer();
    }

    return () => {
      scopesServices?.scopesSelectorService.setRedirectEnabled(true);
      if (drawerWasOpen && !scopesServices?.scopesDashboardsService.state.drawerOpened) {
        scopesServices?.scopesDashboardsService.toggleDrawer();
      }
    };
  }, [scopesServices, isEditing]);

  const { type } = useParams();
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const navModel =
    type === 'snapshot'
      ? getNavModel(
          navIndex,
          'dashboards/snapshots',
          // fallback navModel to prevent showing `Page not found` in snapshots
          getNavModel(navIndex, 'home')
        )
      : getNavModel(navIndex, 'dashboards/browse');
  const isSettingsOpen = editview !== undefined;
  const soloPanelContext = useDefineSoloPanelContext(viewPanel);

  // Remember scroll pos when going into view panel, edit panel or settings
  useMemo(() => {
    if (viewPanel || isSettingsOpen || editPanel) {
      model.rememberScrollPos();
    }
  }, [isSettingsOpen, editPanel, viewPanel, model]);

  // Restore scroll pos when coming back
  useEffect(() => {
    if (!viewPanel && !isSettingsOpen && !editPanel) {
      model.restoreScrollPos();
    }
  }, [isSettingsOpen, editPanel, viewPanel, model]);

  if (editview) {
    return (
      <>
        <editview.Component model={editview} />
        {overlay && <overlay.Component model={overlay} />}
      </>
    );
  }

  /**
   * A previewed plan replaces the dashboard's normal controls with its own: `PlanningControls`
   * carries the plan's action bar and the plan's variables, and deliberately does not render
   * `DashboardControls`, which also hosts save/settings/share. The time picker stays out — a plan's
   * panels have no queries, so a time range would control nothing.
   *
   * Only the new toolbar routes through here. It keeps Save and friends in this very bar, so the
   * plan's bar takes their place; the legacy toolbar keeps them in the app chrome, where
   * NavToolbarActions swaps them instead and this bar stays empty.
   */
  function renderControls() {
    if (planning) {
      return config.featureToggles.dashboardNewLayouts ? (
        <PlanningControls dashboard={model} planning={planning} />
      ) : null;
    }

    return controls && <controls.Component model={controls} />;
  }

  function renderBody() {
    if (!viewPanel && (panelSearch || panelsPerRow)) {
      return <PanelSearchLayout panelSearch={panelSearch} panelsPerRow={panelsPerRow} dashboard={model} />;
    }

    if (soloPanelContext) {
      return (
        <SoloPanelContextProvider value={soloPanelContext} singleMatch={true} dashboard={model}>
          <body.Component model={body} />
        </SoloPanelContextProvider>
      );
    }

    return <body.Component model={body} />;
  }

  return (
    <>
      {layoutOrchestrator && <layoutOrchestrator.Component model={layoutOrchestrator} />}
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Custom}>
        {editPanel && <editPanel.Component model={editPanel} />}
        {!editPanel && (
          <DashboardSidebarSplitter
            dashboard={model}
            isEditing={isEditing}
            isPlanning={Boolean(planning)}
            controls={renderControls()}
            body={renderBody()}
          />
        )}
        {overlay && <overlay.Component model={overlay} />}
      </Page>
    </>
  );
}
