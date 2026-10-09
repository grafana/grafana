import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { type SceneComponentProps } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { getNavModel } from 'app/core/selectors/navModel';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';
import { isFullDashboardEditing } from 'app/features/dashboard-scene/scene/types/dashboard';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { useSelector } from 'app/types/store';

import { DashboardSidebarSplitter } from '../sidebar/DashboardSidebarSplitter';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from '../solo/SoloPanelContext';

import { DashboardOverlay } from './DashboardOverlay';
import { type DashboardScene } from './DashboardScene';
import { PanelSearchLayout } from './PanelSearchLayout';
import { PlanningControls } from './new-toolbar/PlanningControls';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const {
    controls,
    editview,
    body,
    editPanel,
    loadingView,
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
  const isPanelEditorLoading = loadingView === 'editPanel';
  const subViewOpen = useRef(false);

  // Remember scroll pos when going into view panel, edit panel or settings
  useMemo(() => {
    const isOpen = Boolean(viewPanel || isSettingsOpen || editPanel || isPanelEditorLoading);
    if (isOpen && !subViewOpen.current) {
      model.rememberScrollPos();
    }
    subViewOpen.current = isOpen;
  }, [isSettingsOpen, editPanel, viewPanel, isPanelEditorLoading, model]);

  // Restore scroll pos when coming back
  useEffect(() => {
    if (!viewPanel && !isSettingsOpen && !editPanel && !isPanelEditorLoading) {
      model.restoreScrollPos();
    }
  }, [isSettingsOpen, editPanel, viewPanel, isPanelEditorLoading, model]);

  if (isPanelEditorLoading) {
    return (
      <Page navModel={navModel} layout={PageLayoutType.Canvas}>
        <Box paddingY={4} display="flex" direction="column" alignItems="center">
          <PageLoader />
        </Box>
      </Page>
    );
  }

  if (editview) {
    return (
      <>
        <editview.Component model={editview} />
        <DashboardOverlay dashboard={model} />
      </>
    );
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

  /**
   * PlanningControls exposes the plan actions and variables without save/settings/share
   * or a time picker, since placeholders have no queries. The legacy toolbar supplies
   * plan actions through NavToolbarActions in app chrome.
   */
  function renderControls() {
    if (planning) {
      return isDashboardNewLayoutsEnabled() ? <PlanningControls dashboard={model} planning={planning} /> : null;
    }

    return controls && <controls.Component model={controls} />;
  }

  return (
    <>
      {layoutOrchestrator && <layoutOrchestrator.Component model={layoutOrchestrator} />}
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Custom}>
        {editPanel && <editPanel.Component model={editPanel} />}
        {!editPanel && (
          <DashboardSidebarSplitter
            dashboard={model}
            isEditing={isFullDashboardEditing(model.state)}
            isPlanning={Boolean(planning)}
            controls={renderControls()}
            body={renderBody()}
          />
        )}
        <DashboardOverlay dashboard={model} />
      </Page>
    </>
  );
}
