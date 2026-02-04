import { DragDropContext, DropResult, BeforeCapture, DragStart } from '@hello-pangea/dnd';
import { useContext, useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { ScopesContext } from '@grafana/runtime';
import { sceneGraph, SceneComponentProps } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types/store';

import { DashboardEditPaneSplitter } from '../edit-pane/DashboardEditPaneSplitter';

import { DashboardScene } from './DashboardScene';
import { PanelSearchLayout } from './PanelSearchLayout';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from './SoloPanelContext';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';

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
        <SoloPanelContextProvider value={soloPanelContext} singleMatch={true} dashboard={model}>
          <body.Component model={body} />
        </SoloPanelContextProvider>
      );
    }

    return <body.Component model={body} />;
  }

  const handleBeforeCapture = (before: BeforeCapture) => {
    const draggable = sceneGraph.findByKey(model, before.draggableId);
    if (draggable instanceof RowItem) {
      model.state.layoutOrchestrator?.startRowDrag(draggable);
    } else if (draggable instanceof TabItem) {
      model.state.layoutOrchestrator?.startTabDrag(draggable);
    }
  };

  const handleBeforeDragStart = (start: DragStart) => {
    if (start.type === 'ROW') {
      const rowsManager = sceneGraph.findByKey(model, start.source.droppableId);
      if (rowsManager instanceof RowsLayoutManager) {
        rowsManager.forceSelectRow(start.draggableId);
      }
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (result.type === 'ROW') {
      // Stop tracking row drag in orchestrator
      model.state.layoutOrchestrator?.stopRowDrag();

      if (!result.destination) {
        return;
      }

      if (result.destination.index === result.source.index) {
        return;
      }

      const rowsManager = sceneGraph.findByKey(model, result.source.droppableId);
      if (rowsManager instanceof RowsLayoutManager) {
        rowsManager.moveRow(result.draggableId, result.source.index, result.destination.index);
      }

      return;
    }

    if (result.type === 'TAB') {
      model.state.layoutOrchestrator?.endTabDrag(
        result.destination?.droppableId,
        result.source.index,
        result.destination?.index
      );
    }
  };

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
            body={
              <DragDropContext
                onBeforeCapture={handleBeforeCapture}
                onBeforeDragStart={handleBeforeDragStart}
                onDragEnd={handleDragEnd}
              >
                {renderBody()}
              </DragDropContext>
            }
          />
        )}
        {overlay && <overlay.Component model={overlay} />}
      </Page>
    </>
  );
}
