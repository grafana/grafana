import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type SceneComponentProps } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { useSelector } from 'app/types/store';

import { DashboardSidebarSplitter } from '../sidebar/DashboardSidebarSplitter';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from '../solo/SoloPanelContext';

import { type DashboardScene } from './DashboardScene';
import { PanelSearchLayout } from './PanelSearchLayout';
import { PlanningBanner } from './new-toolbar/PlanningBanner';

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
   * A previewed plan has no queries, so the time picker and variable bar would be inert controls
   * over nothing — they come back when the plan is built. What replaces them depends on where this
   * dashboard keeps its actions: the new toolbar puts Save and friends in this very bar, so the
   * plan's banner takes their place here; the legacy toolbar puts them in the app chrome, where
   * NavToolbarActions swaps them instead, leaving this bar simply empty.
   */
  function renderControls() {
    if (planning) {
      // The banner carries no horizontal padding of its own, so give it the same insets
      // DashboardControls uses — otherwise its buttons sit flush against the canvas edge.
      return config.featureToggles.dashboardNewLayouts ? (
        <Box paddingX={2} paddingTop={1}>
          <PlanningBanner planning={planning} />
        </Box>
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
