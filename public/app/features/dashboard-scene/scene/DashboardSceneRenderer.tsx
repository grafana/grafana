import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getNavModel } from 'app/core/selectors/navModel';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';
import { useSelector } from 'app/types';

import { DashboardEditPaneSplitter } from '../edit-pane/DashboardEditPaneSplitter';

import { DashboardScene } from './DashboardScene';
import { PanelSearchLayout } from './PanelSearchLayout';
import { DashboardAngularDeprecationBanner } from './angular/DashboardAngularDeprecationBanner';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const {
    controls,
    overlay,
    editview,
    editPanel,
    isEmpty,
    meta,
    viewPanelScene,
    panelSearch,
    panelsPerRow,
    isEditing,
  } = model.useState();
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const bodyToRender = model.getBodyToRender();
  const navModel = getNavModel(navIndex, 'dashboards/browse');
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

  function renderBody() {
    if (meta.dashboardNotFound) {
      return <EntityNotFound entity="Dashboard" key="dashboard-not-found" />;
    }

    if (panelSearch || panelsPerRow) {
      return <PanelSearchLayout panelSearch={panelSearch} panelsPerRow={panelsPerRow} dashboard={model} />;
    }

    return (
      <>
        <DashboardAngularDeprecationBanner dashboard={model} key="angular-deprecation-banner" />
        {isEmpty && (
          <DashboardEmpty dashboard={model} canCreate={!!model.state.meta.canEdit} key="dashboard-empty-state" />
        )}
        <bodyToRender.Component model={bodyToRender} />
      </>
    );
  }

  return (
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
  );
}
