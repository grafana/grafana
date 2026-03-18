import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { CollabProvider } from 'app/features/dashboard-collab/CollabProvider';
import { CollabCursorOverlay } from 'app/features/dashboard-collab/CollabCursorOverlay';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { useSelector } from 'app/types/store';

import { DashboardEditPaneSplitter } from '../edit-pane/DashboardEditPaneSplitter';

import { DashboardScene } from './DashboardScene';
import { PanelSearchLayout } from './PanelSearchLayout';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from './SoloPanelContext';

function useCollabEnabled(model: DashboardScene): boolean {
  const { uid, meta } = model.useState();
  return useMemo(() => {
    if (!config.featureToggles.dashboardCollaboration) {
      return false;
    }
    if (!uid) {
      return false;
    }
    if (meta?.provisioned) {
      return false;
    }
    return true;
  }, [uid, meta]);
}

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
    uid,
    layoutOrchestrator,
  } = model.useState();

  const collabEnabled = useCollabEnabled(model);

  const scopesServices = useScopesServices();

  // Disable scope redirects while in edit mode so users aren't navigated away mid-edit.
  useEffect(() => {
    scopesServices?.scopesSelectorService.setRedirectEnabled(!isEditing);
    return () => {
      scopesServices?.scopesSelectorService.setRedirectEnabled(true);
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

  const content = (
    <>
      {layoutOrchestrator && <layoutOrchestrator.Component model={layoutOrchestrator} />}
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Custom}>
        {editPanel && <editPanel.Component model={editPanel} />}
        {!editPanel && (
          <DashboardEditPaneSplitter
            dashboard={model}
            isEditing={isEditing}
            controls={controls && <controls.Component model={controls} />}
            body={renderBody()}
          />
        )}
        {overlay && <overlay.Component model={overlay} />}
      </Page>
    </>
  );

  if (collabEnabled && uid) {
    return (
      <CollabProvider scene={model} dashboardUID={uid} namespace="default">
        <CollabCursorOverlay />
        {content}
      </CollabProvider>
    );
  }

  return content;
}
