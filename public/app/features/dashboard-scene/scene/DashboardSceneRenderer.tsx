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
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

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
    // BeforeCapture does not include the draggable "type".
    // Only rows need special orchestrator handling for cross-tab row drags, so we
    // attempt a lookup and only act if the draggable is a RowItem.
    const row = sceneGraph.findByKey(model, before.draggableId);
    if (row instanceof RowItem) {
      model.state.layoutOrchestrator?.startRowDrag(row);
    }
  };

  const handleBeforeDragStart = (start: DragStart) => {
    if (start.type === 'ROW') {
      const rowsManager = sceneGraph.findByKey(model, start.source.droppableId);
      if (rowsManager instanceof RowsLayoutManager) {
        rowsManager.forceSelectRow(start.draggableId);
      }
    }

    // if (start.type === 'TAB') {
    //   // Intentionally do not select the tab in the edit pane on drag start.
    //   // Selecting triggers side pane updates / lazy loads, which can cause a noticeable hitch
    //   // on the first drag. We focus the moved tab on drop (cross-group) instead.
    // }
  };

  const mapTabInsertIndex = (destination: TabsLayoutManager, destinationIndexIncludingRepeats: number): number => {
    const allTabs = destination.getTabsIncludingRepeats();
    const ranges = new Map<string, { start: number; end: number }>();

    for (let i = 0; i < allTabs.length; i++) {
      const t = allTabs[i];
      const originalKey = t.state.repeatSourceKey ?? t.state.key;
      if (!originalKey) {
        continue;
      }
      const existing = ranges.get(originalKey);
      if (!existing) {
        ranges.set(originalKey, { start: i, end: i + 1 });
      } else {
        existing.end = i + 1;
      }
    }

    const originalTabs = destination.state.tabs;
    const insertAt = Math.max(0, Math.min(destinationIndexIncludingRepeats, allTabs.length));

    for (let originalIndex = 0; originalIndex < originalTabs.length; originalIndex++) {
      const originalKey = originalTabs[originalIndex].state.key;
      if (!originalKey) {
        continue;
      }
      const range = ranges.get(originalKey);
      if (!range) {
        continue;
      }

      // If inserting before the group, insert before this original tab.
      if (insertAt <= range.start) {
        return originalIndex;
      }

      // If inserting inside the group (between original and its repeats), insert after the group.
      if (insertAt < range.end) {
        return originalIndex + 1;
      }
    }

    return originalTabs.length;
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
      if (!result.destination) {
        return;
      }

      const sourceManager = sceneGraph.findByKey(model, result.source.droppableId);
      const destinationManager = sceneGraph.findByKey(model, result.destination.droppableId);
      const tab = sceneGraph.findByKey(model, result.draggableId);

      if (!(sourceManager instanceof TabsLayoutManager) || !(destinationManager instanceof TabsLayoutManager)) {
        return;
      }
      if (!(tab instanceof TabItem)) {
        return;
      }

      if (sourceManager === destinationManager) {
        if (result.destination.index === result.source.index) {
          return;
        }
        sourceManager.moveTab(result.source.index, result.destination.index);
        return;
      }

      const destinationIndex = mapTabInsertIndex(destinationManager, result.destination.index);
      // When moving a tab into a new tab group, make it the active tab.
      sourceManager.moveTabToManager(tab, destinationManager, destinationIndex);
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
