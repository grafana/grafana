import { useContext, useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { ScopesContext } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types/store';

import { DashboardEditPaneSplitter } from '../edit-pane/DashboardEditPaneSplitter';

import { DashboardScene } from './DashboardScene';
import { PanelSearchLayout } from './PanelSearchLayout';
import { SoloPanelContext, useDefineSoloPanelContext } from './SoloPanelContext';

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
  } = model.useState();
  const { type } = useParams();
  const location = useLocation();
  const scopesContext = useContext(ScopesContext);
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const navModel = getNavModel(navIndex, `dashboards/${type === 'snapshot' ? 'snapshots' : 'browse'}`);
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

  useEffect(() => {
    if (scopesContext && isEditing) {
      scopesContext.setReadOnly(true);

      return () => {
        scopesContext.setReadOnly(false);
      };
    }

    return;
  }, [scopesContext, isEditing]);

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
        <SoloPanelContext.Provider value={soloPanelContext}>
          <body.Component model={body} />
        </SoloPanelContext.Provider>
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
}
